"""
Billing Views Module.

This module handles the entire subscription lifecycle, payment processing, and
financial logging for the multi-tenant SaaS platform.

Key Components:
1.  **Plans (Public):** Read-only list of available pricing tiers.
2.  **Subscriptions (Tenant):** Creation, renewal, and cancellation of plans.
    - Integrates with Paystack for payment initialization.
3.  **Transactions (Tenant):** Read-only history of payments.
4.  **Webhooks (Public):** The critical entry point for Paystack to notify
    the system of payment success/failure. Handles automatic activation and
    expiration logic.
5.  **Admin Views (Superuser):** "God Mode" views for system administrators
    to manually extend subscriptions or audit financial logs globally.
"""

from rest_framework import viewsets, status, serializers, permissions, filters
from rest_framework.views import APIView
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from datetime import timedelta
from django.utils import timezone
from django.shortcuts import get_object_or_404
import hmac, hashlib, json, logging, uuid
from .models import Plan, Subscription, Transaction
from .serializers import PlanSerializer, SubscriptionSerializer, TransactionSerializer
from .services.paystack import PaystackService
from tenants.models import Tenant
from .tasks import verify_paystack_transaction_task, notify_subscription_cancellation_task, notify_payment_status_task
from django.core.mail import send_mail
from .permissions import IsCompanySuperUser
from users.permissions import IsTenantAdmin, IsTenantAdminOrManager
from django_filters.rest_framework import DjangoFilterBackend

logger = logging.getLogger("billing.webhook")


# -------------------------------------------------------------------
# 1 Plans ViewSet (Public Read-Only)
# -------------------------------------------------------------------
class PlanViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Public API endpoint to list all active Pricing Plans.

    Used by the frontend (Landing Page or Pricing Page) to display available
    tiers (e.g., Free, Pro, Enterprise) and their costs.
    """
    queryset = Plan.objects.filter(is_active=True).order_by('amount')
    serializer_class = PlanSerializer
    permission_classes = [AllowAny]  # Public


# -------------------------------------------------------------------
# 2 Subscriptions ViewSet (Tenant Scoped)
# -------------------------------------------------------------------
class SubscriptionViewSet(viewsets.ModelViewSet):
    """
    Manages Subscription lifecycle for a specific Tenant.

    Capabilities:
    - List: View current and past subscriptions.
    - Create: Initialize a new subscription and generate a Paystack payment link.
    - Cancel: Stop auto-renewal or immediately terminate pending subscriptions.

    Access:
    - Restricted to Tenant Admins or Managers.
    - Data is scoped strictly to the authenticated user's tenant.
    """
    serializer_class = SubscriptionSerializer
    permission_classes = [IsAuthenticated & IsTenantAdminOrManager]

    def get_queryset(self):
        """
        Filters subscriptions to the requesting user's tenant.
        Superusers can see all subscriptions globally.
        """
        user = self.request.user
        if user.is_superuser:
            return Subscription.objects.all().order_by('-created_at')
        tenant = getattr(user, 'tenant', None)
        if not tenant:
            return Subscription.objects.none()
        return Subscription.objects.filter(tenant=tenant).order_by('-created_at')

    # FIXED: Changed from 'perform_create' to 'create' to control the Response
    def create(self, request, *args, **kwargs):
        """
        Initializes a Subscription and generates a Payment Link.

        Logic Flow:
        1. Validates selected Plan.
        2. Creates a 'Pending' Subscription record in the database.
        3. Calls Paystack API to initialize the transaction.
        4. Logs the transaction as 'Pending'.

        Returns:
            Response: Contains the Paystack Authorization URL. The frontend
            should redirect the user to this URL to complete payment.
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = self.request.user
        tenant = getattr(user, 'tenant', None)
        if not tenant:
            raise serializers.ValidationError("User is not associated with a tenant.")

        plan = serializer.validated_data['plan']

        # Save subscription
        subscription = serializer.save(tenant=tenant, status="pending")

        # Generate Paystack Reference
        reference = f"sub_{subscription.id}_{uuid.uuid4().hex[:8]}"
        amount = plan.amount
        email = getattr(user, 'email', None) or f"{tenant.slug}@no-email.local"

        # Call Paystack
        try:
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
        except Exception as e:
            # Fallback if Paystack fails: return the subscription but with an error message
            logger.error(f"Paystack Init Failed: {e}")
            return Response({
                "subscription": serializer.data, 
                "message": "Subscription created but payment initialization failed."
            }, status=status.HTTP_201_CREATED)

        # Save Reference to Subscription
        tx_data = ps_resp.get('data', {}) or {}
        paystack_ref = tx_data.get('reference') or reference
        subscription.paystack_reference = paystack_ref
        subscription.save(update_fields=["paystack_reference"])

        # Create Transaction Record
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

        # NOW this response will actually be sent to the frontend
        return Response(ps_resp, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], permission_classes=[IsTenantAdmin])
    def cancel(self, request, pk=None):
        """
        Cancels a subscription.

        Logic distinguishes between 'Active' vs 'Pending' subscriptions:
        1. **Active (Paid):** - Does NOT immediately revoke access.
           - Sets `auto_renew = False`.
           - User keeps access until `expires_at`.
        
        2. **Pending/Unpaid:** - Immediately sets status to 'Cancelled'.
           - Revokes access immediately.
        """
        subscription = self.get_object()

        # 1. Safety Check: If already inactive, stop.
        if subscription.status in ["cancelled", "expired"]:
             return Response(
                 {"detail": "Subscription is already inactive."}, 
                 status=status.HTTP_400_BAD_REQUEST
             )

        # 2. Production Logic: Graceful Cancellation
        # If the user has paid (Active) and has time left, just disable auto-renewal.
        if subscription.status == "active":
            subscription.auto_renew = False
            subscription.save(update_fields=["auto_renew"])
            
            # We trigger the notification task (you might want to update the email wording later)
            notify_subscription_cancellation_task.delay(subscription.id)
            
            return Response({
                "detail": f"Auto-renewal disabled. access continues until {subscription.expires_at.date()}.",
                "status": "active",
                "auto_renew": False
            }, status=status.HTTP_200_OK)

        # 3. Immediate Cancellation (e.g. Pending/Unpaid)
        # If they haven't paid yet, kill it immediately.
        else:
            subscription.status = "cancelled"
            subscription.auto_renew = False
            subscription.expires_at = timezone.now()
            subscription.save(update_fields=["status", "auto_renew", "expires_at"])
            
            return Response({"detail": "Subscription cancelled immediately."}, status=status.HTTP_200_OK)
    
    
class SubscriptionRenewView(APIView):
    """
    Generates a fresh Payment Link for an existing subscription.
    
    This is used when:
    1. A payment failed previously and the user wants to retry.
    2. A user wants to manually renew a subscription before auto-renewal kicks in.
    
    Access: Tenant Admin/Manager only.
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
# 3 Transactions ViewSet (Tenant Scoped)
# -------------------------------------------------------------------
class TransactionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only view of Payment History.

    Allows tenants to see their past payments, including successful charges
    and failed attempts.
    """
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated & IsTenantAdmin]
    # --- ADD SEARCH CAPABILITY ---
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['reference', 'status', 'amount']
    ordering_fields = ['created_at', 'amount']
    # -----------------------------

    def get_queryset(self):
        """
        Limits transactions to the authenticated user's tenant.
        """
        user = self.request.user
        if user.is_superuser:
            return Transaction.objects.all().order_by('-created_at')
        tenant = getattr(user, 'tenant', None)
        if not tenant:
            return Transaction.objects.none()
        return Transaction.objects.filter(tenant=tenant).order_by('-created_at')


# -------------------------------------------------------------------
# 4 Paystack Webhook (Public)
# -------------------------------------------------------------------
@csrf_exempt
@api_view(["POST"])
@permission_classes([AllowAny])
def paystack_webhook(request):
    """
    The Single Source of Truth for payment confirmation.

    This endpoint is called by Paystack servers (not the user).
    
    Security:
    - Verifies the 'x-paystack-signature' header using HMAC SHA512.
    - Explicitly verifies the reference again via API to prevent spoofing.

    Logic:
    - If Success:
        - Finds the subscription via metadata.
        - Calculates new expiry date (Extends if active, restarts if expired).
        - Sets Status = Active.
        - Sets Auto Renew = True.
    - If Failed:
        - Marks transaction and subscription as failed/pending.
    """
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

    # Verify transaction with Paystack to be sure
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

    # --- FIX 1: REMOVED 'paid_at' to prevent crash ---
    transaction, _ = Transaction.objects.get_or_create(
        reference=reference,
        defaults={
            "subscription": subscription,
            "tenant_id": tenant_id,  # Ensure tenant is linked if your model requires it
            "amount": verify_resp["data"]["amount"] / 100,
            "status": status_data,
            # "paid_at": verify_resp["data"]["paid_at"],  <-- REMOVED THIS LINE
        },
    )
    transaction.status = status_data
    transaction.save(update_fields=["status"])

    if status_data == "success":
        plan = getattr(subscription, "plan", None)
        days = getattr(plan, "duration_days", 30)
        now = timezone.now()

        # --- FIX 2: Better Renewal Logic ---
        # If renewing EARLY (active & future expiry), add time to the existing expiry.
        # If expired, start fresh from NOW.
        if subscription.status == "active" and subscription.expires_at and subscription.expires_at > now:
            subscription.expires_at = subscription.expires_at + timezone.timedelta(days=days)
            # We do NOT change started_at, as the cycle is just extending
        else:
            # Subscription was expired or pending, so we restart the clock
            subscription.started_at = now
            subscription.expires_at = now + timezone.timedelta(days=days)

        subscription.status = "active"
        subscription.paystack_reference = reference
        subscription.auto_renew = True  # Ensure auto-renew is explicitly ON after payment
        
        subscription.save(update_fields=["status", "started_at", "expires_at", "paystack_reference", "auto_renew"])
        
        # Notify tenant admins/managers
        notify_payment_status_task.delay(subscription.id, "success")

        logger.info(f"✅ Subscription {subscription_id} renewed/activated for tenant {tenant_id}.")
        
    elif status_data == "failed":
        subscription.status = "pending"
        subscription.save(update_fields=["status"])
        
        # Notify tenant admins/managers
        notify_payment_status_task.delay(subscription.id, "failed")
        
        logger.warning(f"⚠️ Payment failed for {subscription_id}.")

    return Response({"status": True, "message": "Webhook processed successfully"}, status=200)

# -------------------------------------------------------------------
# 5 Manual Verification Endpoint (for testing via Swagger)
# -------------------------------------------------------------------
class PaystackVerifyView(APIView):
    """
    Debug Endpoint: Manually trigger transaction verification.

    Useful if a webhook was missed or for local development testing.
    This mimics the logic of the webhook but is triggered via GET request
    by an authenticated Admin.
    """
    permission_classes = [IsAuthenticated & IsTenantAdmin]

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
                    "detail": "Payment verified successfully.",
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
class GlobalSubscriptionViewSet(viewsets.ModelViewSet):
    """
    System Admin (Superuser) ViewSet for Global Subscription Management.

    "God Mode" capabilities:
    - View subscriptions across ALL tenants.
    - Manually extend subscriptions (e.g., compensation for downtime).
    - Force-cancel subscriptions (e.g., policy violations).
    """
    queryset = Subscription.objects.select_related("tenant", "plan").all().order_by("-created_at")
    serializer_class = SubscriptionSerializer
    permission_classes = [IsCompanySuperUser]
    
    # Enable filtering so the dashboard can find a specific tenant's sub
    filter_backends = [filters.SearchFilter, filters.OrderingFilter, DjangoFilterBackend]
    filterset_fields = ['tenant', 'status', 'plan']
    search_fields = ["tenant__name", "tenant__slug"]
    
    

    # --- GOD MODE ACTION: EXTEND SUBSCRIPTION ---
    @action(detail=True, methods=['post'])
    def extend_subscription(self, request, pk=None):
        """
        Manually extends a subscription's expiry date.

        Args:
            days (int): Number of days to add.

        Logic:
            - If active/future expiry: Adds days to existing expiry date.
            - If expired: Resets expiry to Now + days and reactivates.
        """
        subscription = self.get_object()
        days = int(request.data.get('days', 0))

        if days <= 0:
            return Response({"error": "Days must be positive"}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        
        # Logic: If not expired yet, add days to the current expiry.
        # If already expired, start fresh from NOW + days.
        if subscription.expires_at and subscription.expires_at > now:
            subscription.expires_at += timedelta(days=days)
        else:
            subscription.expires_at = now + timedelta(days=days)
            subscription.status = 'active' # Reactivate if it was expired/cancelled

        subscription.save()
        
        return Response({
            "message": f"Extended by {days} days.",
            "new_expires_at": subscription.expires_at,
            "status": subscription.status
        })

    # --- GOD MODE ACTION: CANCEL IMMEDIATELY ---
    @action(detail=True, methods=['post'])
    def cancel_now(self, request, pk=None):
        """
        Force-cancels a subscription immediately.
        
        Used by admins to terminate access instantly, regardless of payment status.
        """
        subscription = self.get_object()
        subscription.status = 'cancelled'
        # Optional: You might want to set expires_at to now, or keep it running until the end
        subscription.save()
        return Response({"status": "cancelled", "message": "Subscription terminated immediately."})


class GlobalTransactionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    System Admin View for Audit Logs.
    
    ReadOnly access to all financial transactions across the platform.
    Used for platform-wide revenue analysis and debugging payment issues.
    """
    queryset = Transaction.objects.select_related("tenant", "subscription").all().order_by("-created_at")
    serializer_class = TransactionSerializer
    permission_classes = [IsCompanySuperUser]
    
    filter_backends = [filters.SearchFilter, filters.OrderingFilter, DjangoFilterBackend]
    filterset_fields = ['tenant', 'status', 'reference']
    search_fields = ["tenant__name", "reference"]