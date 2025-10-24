from celery import shared_task
from django.utils import timezone
from django.conf import settings
import logging
from billing.models import Subscription, Transaction
from billing.services.paystack import PaystackService
from billing.utils import send_billing_alert_email
import uuid

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def verify_paystack_transaction_task(self, reference):
    """
    Verify Paystack transaction asynchronously.
    """
    try:
        logger.info(f"🔍 Verifying Paystack transaction: {reference}")
        result = PaystackService.verify_transaction(reference)
        data = result.get("data")

        if not data:
            logger.error(f"❌ Empty verification data for reference {reference}")
            return

        status = data.get("status")
        if status == "success":
            sub = Subscription.objects.filter(paystack_reference=reference).first()
            if sub:
                sub.status = "active"
                sub.started_at = timezone.now()
                # Use plan duration dynamically
                duration_days = getattr(sub.plan, "duration_days", 30)
                sub.expires_at = sub.started_at + timezone.timedelta(days=duration_days)
                sub.save(update_fields=["status", "started_at", "expires_at"])
                logger.info(f"✅ Subscription activated for {sub.tenant.slug}")
            else:
                logger.warning(f"⚠️ No subscription found for reference {reference}")
        else:
            logger.warning(f"❌ Payment not successful for reference {reference}")

    except Exception as exc:
        logger.exception(f"Error verifying Paystack transaction {reference}: {exc}")
        self.retry(exc=exc)


@shared_task
def auto_renew_subscriptions_task():
    """
    Automatically renew subscriptions that are about to expire or have just expired.
    Sends escalation emails if renewal fails.
    Grace period: 3 days after expiry before marking as fully expired.
    """
    now = timezone.now()
    grace_period_days = 3
    renewal_window = timezone.timedelta(days=1)

    # Mark overdue subscriptions as expired
    expired_cutoff = now - timezone.timedelta(days=grace_period_days)
    overdue = Subscription.objects.filter(
        status="active",
        expires_at__lt=expired_cutoff
    )

    for sub in overdue:
        sub.status = "expired"
        sub.save(update_fields=["status"])
        logger.info(f"⚠️ Marked subscription {sub.id} for tenant '{sub.tenant.slug}' as expired (past grace period).")

    # Subscriptions eligible for renewal
    expiring = Subscription.objects.filter(
        auto_renew=True,
        status__in=["active", "expired"],
        expires_at__lte=now + renewal_window,
        expires_at__gte=expired_cutoff
    )

    logger.info(f"🔁 Found {expiring.count()} subscriptions eligible for auto-renewal check at {now}.")

    for sub in expiring:
        tenant = sub.tenant
        owner = getattr(tenant, "owner", None)
        email = getattr(owner, "email", None)
        name = getattr(owner, "get_full_name", lambda: tenant.name)()

        try:
            logger.info(f"🔁 Attempting auto-renewal for tenant '{tenant.slug}'")

            if not email:
                logger.warning(f"⚠️ Tenant '{tenant.name}' has no owner email — skipping auto-renew.")
                continue

            plan = sub.plan
            if not plan:
                logger.warning(f"⚠️ Subscription {sub.id} has no plan — skipping.")
                continue

            # ✅ Generate proper Paystack metadata and amount (in naira)
            reference = f"AUTO-{tenant.slug}-{uuid.uuid4().hex[:8]}"
            result = PaystackService.create_payment_link(
                email=email,
                amount=plan.amount,  # now in naira
                reference=reference,
                metadata={
                    "tenant_id": tenant.id,
                    "subscription_id": sub.id,
                    "plan_id": plan.id,
                    "auto_renewal": True,
                }
            )

            data = result.get("data")
            if not data or not data.get("reference"):
                raise ValueError("Invalid response from Paystack during renewal link creation.")

            paystack_ref = data["reference"]
            sub.paystack_reference = paystack_ref
            sub.status = "pending"
            sub.save(update_fields=["paystack_reference", "status"])

            #  Record Transaction
            Transaction.objects.create(
                tenant=tenant,
                subscription=sub,
                reference=paystack_ref,
                amount=plan.amount,
                currency=plan.currency,
                status='pending',
                raw_response=result
            )

            logger.info(f"✅ Renewal link generated for {tenant.slug} — waiting for payment confirmation.")

        except Exception as e:
            logger.exception(f"❌ Auto-renew failed for tenant '{tenant.slug}': {e}")

            if not email:
                logger.warning(f"⚠️ Skipping escalation email for tenant '{tenant.name}' (no owner email).")
                continue

            recipients = [email]
            if hasattr(settings, "SUPPORT_EMAIL"):
                recipients.append(settings.SUPPORT_EMAIL)

            subject = f"Subscription Renewal Failed for {tenant.name}"
            message = (
                f"Dear {name},\n\n"
                f"Automatic renewal for your Smart Inventory subscription failed.\n"
                f"Please log in and manually renew to avoid service interruption.\n\n"
                f"Tenant: {tenant.name}\nError: {str(e)}\n\n"
                f"- Smart Inventory Billing System"
            )

            send_billing_alert_email(subject, message, recipients)





