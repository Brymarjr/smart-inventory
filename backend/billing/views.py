from rest_framework import viewsets, status, serializers, permissions, filters
from rest_framework.views import APIView
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from django.utils import timezone
from django.shortcuts import get_object_or_404
import hmac, hashlib, json, logging, uuid
from .models import Plan, Subscription, Transaction
from .serializers import PlanSerializer, SubscriptionSerializer, TransactionSerializer
from .services.paystack import PaystackService
from tenants.models import Tenant
from .tasks import verify_paystack_transaction_task
from django.core.mail import send_mail
from .permissions import IsCompanySuperUser
from users.permissions import IsTenantAdmin, IsFinanceOfficer, IsTenantAdminOrManager, IsFinanceOrAdmin

logger = logging.getLogger("billing.webhook")


# -------------------------------------------------------------------
# 1️⃣ Plans ViewSet (Public Read-Only)
# -------------------------------------------------------------------
class PlanViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Plan.objects.filter(is_active=True).order_by('amount')
    serializer_class = PlanSerializer
    permission_classes = [AllowAny]  # Public


# -------------------------------------------------------------------
# 2️⃣ Subscriptions ViewSet (Tenant Scoped)
# -------------------------------------------------------------------
class SubscriptionViewSet(viewsets.ModelViewSet):
    serializer_class = SubscriptionSerializer
    permission_classes = [IsAuthenticated & IsTenantAdminOrManager]

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            return Subscription.objects.all().order_by('-created_at')
        tenant = getattr(user, 'tenant', None)
        if not tenant:
            return Subscription.objects.none()
        return Subscription.objects.filter(tenant=tenant).order_by('-created_at')

    def perform_create(self, serializer):
        user = self.request.user
        tenant = getattr(user, 'tenant', None)
        if not tenant:
            raise serializers.ValidationError("User is not associated with a tenant.")

        plan = serializer.validated_data['plan']

        subscription = serializer.save(tenant=tenant, status="pending")

        reference = f"sub_{subscription.id}_{uuid.uuid4().hex[:8]}"
        amount = plan.amount
        email = getattr(user, 'email', None) or f"{tenant.slug}@no-email.local"

        ps_resp = PaystackService.create_payment_link(
            email=email,
            amount=amount,
            reference=reference,
            metadata={
                "tenant_id": tenant.id,
                "subscription_id": subscription.id,
                "plan_id": plan.id,
            }
        )

        tx_data = ps_resp.get('data', {}) or {}
        paystack_ref = tx_data.get('reference') or reference
        subscription.paystack_reference = paystack_ref
        subscription.save(update_fields=["paystack_reference"])

        Transaction.objects.create(
            tenant=tenant,
            subscription=subscription,
            reference=paystack_ref,
            amount=amount,
            currency=plan.currency,
            status='pending',
            raw_response=ps_resp
        )

        logger.info(f"✅ Created pending subscription {subscription.id} with reference {paystack_ref}")

        return Response(ps_resp, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], permission_classes=[IsTenantAdmin])
    def cancel(self, request, pk=None):
        subscription = self.get_object()
        subscription.status = "cancelled"
        subscription.auto_renew = False
        subscription.expires_at = timezone.now()
        subscription.save()
        return Response({"detail": "Subscription cancelled."}, status=status.HTTP_200_OK)
    
    
class SubscriptionRenewView(APIView):
    """
    Generate a fresh Paystack payment link for a subscription.
    Only accessible to tenant admins/managers.
    """
    permission_classes = [IsAuthenticated, IsTenantAdminOrManager]

    def post(self, request, subscription_id):
        user = request.user
        tenant = getattr(user, "tenant", None)
        if not tenant:
            return Response(
                {"detail": "User does not belong to a tenant."},
                status=status.HTTP_403_FORBIDDEN
            )

        subscription = get_object_or_404(Subscription, id=subscription_id, tenant=tenant)

        if subscription.plan.name.lower() == "free":
            return Response(
                {"detail": "Free subscriptions cannot be renewed manually."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Generate a fresh unique reference
        reference = f"RENEW-{tenant.slug}-{subscription.id}-{uuid.uuid4().hex[:6]}"

        try:
            payment_resp = PaystackService.create_payment_link(
                email=user.email,
                amount=subscription.plan.amount,
                reference=reference,
                metadata={
                    "tenant_id": tenant.id,
                    "subscription_id": subscription.id,
                    "plan_id": subscription.plan.id
                }
            )
            pay_url = payment_resp.get("data", {}).get("authorization_url")
            if not pay_url:
                logger.error(f"Failed to get authorization URL from Paystack for subscription {subscription.id}")
                return Response(
                    {"detail": "Failed to generate payment link."},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            logger.info(f"✅ Generated new Paystack link for subscription {subscription.id} (tenant {tenant.slug})")
            return Response({
                "subscription_id": subscription.id,
                "plan": subscription.plan.name,
                "amount": subscription.plan.amount,
                "payment_url": pay_url,
                "reference": reference
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.exception(f"❌ Error generating renewal link for subscription {subscription.id}: {e}")
            return Response(
                {"detail": "Error generating payment link."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# -------------------------------------------------------------------
# 3️⃣ Transactions ViewSet (Tenant Scoped)
# -------------------------------------------------------------------
class TransactionViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated & IsFinanceOrAdmin]

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            return Transaction.objects.all().order_by('-created_at')
        tenant = getattr(user, 'tenant', None)
        if not tenant:
            return Transaction.objects.none()
        return Transaction.objects.filter(tenant=tenant).order_by('-created_at')


# -------------------------------------------------------------------
# 4️⃣ Paystack Webhook (Public)
# -------------------------------------------------------------------
@csrf_exempt
@api_view(["POST"])
@permission_classes([AllowAny])
def paystack_webhook(request):
    secret = getattr(settings, "PAYSTACK_SECRET_KEY", "")
    signature = request.headers.get("x-paystack-signature")

    computed_sig = hmac.new(
        secret.encode("utf-8"),
        msg=request.body,
        digestmod=hashlib.sha512
    ).hexdigest()

    if not hmac.compare_digest(computed_sig, signature or ""):
        logger.warning("❌ Invalid Paystack signature.")
        return Response({"status": False, "message": "Invalid signature"}, status=400)

    event = request.data.get("event")
    data = request.data.get("data", {})
    reference = data.get("reference")

    logger.info(f"📩 Paystack webhook received: {event}, ref={reference}")

    paystack_service = PaystackService()
    verify_resp = paystack_service.verify_transaction(reference)
    if not verify_resp.get("status"):
        logger.error(f"❌ Paystack verification failed for {reference}: {verify_resp}")
        return Response({"status": False, "message": "Verification failed"}, status=400)

    status_data = verify_resp["data"]["status"]
    metadata = verify_resp["data"].get("metadata", {})
    subscription_id = metadata.get("subscription_id")
    tenant_id = metadata.get("tenant_id")

    try:
        subscription = Subscription.objects.get(id=subscription_id, tenant_id=tenant_id)
    except Subscription.DoesNotExist:
        logger.error(f"❌ Subscription not found for id={subscription_id}, tenant={tenant_id}")
        return Response({"status": False, "message": "Subscription not found"}, status=404)

    transaction, _ = Transaction.objects.get_or_create(
        reference=reference,
        defaults={
            "subscription": subscription,
            "amount": verify_resp["data"]["amount"] / 100,
            "status": status_data,
            "paid_at": verify_resp["data"]["paid_at"],
        },
    )
    transaction.status = status_data
    transaction.save(update_fields=["status"])

    if status_data == "success":
        subscription.status = "active"
        subscription.paystack_reference = reference
        subscription.started_at = timezone.now()
        plan = getattr(subscription, "plan", None)
        days = getattr(plan, "duration_days", 30)
        subscription.expires_at = subscription.started_at + timezone.timedelta(days=days)
        subscription.save(update_fields=["status", "started_at", "expires_at", "paystack_reference"])

        logger.info(f"✅ Subscription {subscription_id} reactivated for tenant {tenant_id}.")
    elif status_data == "failed":
        subscription.status = "pending"
        subscription.save(update_fields=["status"])
        logger.warning(f"⚠️ Payment failed for {subscription_id}.")

    return Response({"status": True, "message": "Webhook processed successfully"}, status=200)


# -------------------------------------------------------------------
# 5️⃣ Manual Verification Endpoint (for testing via Swagger)
# -------------------------------------------------------------------
class PaystackVerifyView(APIView):
    permission_classes = [IsAuthenticated & IsFinanceOrAdmin]

    def get(self, request, *args, **kwargs):
        reference = request.query_params.get("reference")
        if not reference:
            return Response({"error": "reference query param required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            ps_resp = PaystackService.verify_transaction(reference)
            data = ps_resp.get("data", {})
            status_data = data.get("status")
            metadata = data.get("metadata", {}) or {}

            tenant_id = metadata.get("tenant_id")
            subscription_id = metadata.get("subscription_id")
            plan_id = metadata.get("plan_id")

            tenant = Tenant.objects.filter(id=tenant_id).first()
            subscription = Subscription.objects.filter(id=subscription_id).first()

            if not (tenant and subscription):
                return Response({"error": "Tenant or Subscription not found"}, status=status.HTTP_404_NOT_FOUND)

            Transaction.objects.filter(reference=reference).update(
                status=status_data,
                raw_response=ps_resp
            )

            if status_data == "success":
                plan = subscription.plan or Plan.objects.filter(id=plan_id).first()
                subscription.status = "active"
                subscription.started_at = subscription.started_at or timezone.now()
                if plan:
                    days = getattr(plan, "duration_days", 30)
                    subscription.expires_at = subscription.started_at + timezone.timedelta(days=days)

                subscription.paystack_reference = reference
                subscription.save()

                return Response({
                    "detail": "✅ Payment verified successfully.",
                    "subscription_id": subscription.id,
                    "reference": reference,
                    "expires_at": subscription.expires_at
                }, status=status.HTTP_200_OK)
            else:
                return Response({"detail": "❌ Payment not successful."}, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            logger.exception("Verification error")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# -------------------------------------------------------------------
# ADMIN VIEWS (Superuser Only)
# -------------------------------------------------------------------
class GlobalSubscriptionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Subscription.objects.select_related("tenant", "plan").all().order_by("-created_at")
    serializer_class = SubscriptionSerializer
    permission_classes = [IsCompanySuperUser]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["tenant__name", "tenant__slug", "status", "plan__name"]
    ordering_fields = ["created_at", "expires_at"]


class GlobalTransactionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Transaction.objects.select_related("tenant", "subscription").all().order_by("-created_at")
    serializer_class = TransactionSerializer
    permission_classes = [IsCompanySuperUser]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["tenant__name", "tenant__slug", "status", "reference"]
    ordering_fields = ["created_at", "amount"]

