# backend/billing/tasks.py
from celery import shared_task
from django.utils import timezone
from billing.models import Subscription
from notifications.models import Notification
from notifications.tasks import send_notification_email
from billing.services.paystack import PaystackService
from users.models import User
from django.urls import reverse
from django.conf import settings
import logging
import uuid

logger = logging.getLogger(__name__)

# -------------------------------------------------------------------
# Notify tenants about expiring subscriptions
# -------------------------------------------------------------------
@shared_task
def notify_expiring_subscriptions_task(days_before_expiry=7):
    """
    Notify tenant admins/managers about subscriptions expiring in `days_before_expiry`.
    Runs once daily.
    """
    today = timezone.now().date()
    target_date = today + timezone.timedelta(days=days_before_expiry)

    expiring_subs = Subscription.objects.filter(
        status="active",
        expires_at__date=target_date
    ).exclude(plan__name__iexact="free")

    logger.info(f"🔔 Found {expiring_subs.count()} subscriptions expiring on {target_date}")

    for sub in expiring_subs:
        tenant = sub.tenant

        recipients = User.objects.filter(
            tenant=tenant,
            role__name__in=["tenant_admin", "manager"],
            is_active=True,
        )

        if not recipients.exists():
            continue

        for user in recipients:
            # In-app notification
            title = f"Your subscription expires in {days_before_expiry} day(s)"
            message = (
                f"Dear {user.get_full_name()}, your tenant's subscription for plan "
                f"'{sub.plan.name}' will expire on {sub.expires_at.date()}."
            )
            notification = Notification.objects.create(
                tenant=tenant,
                recipient=user,
                title=title,
                message=message,
                notification_type="billing",
            )

            # Queue the email
            send_notification_email.delay(notification.id)

            # Add a backend renewal link instead of generating Paystack URL directly
            if sub.plan.name.lower() != "free":
                try:
                    renew_url = settings.FRONTEND_BASE_URL + reverse(
                        "billing:subscription-renew", kwargs={"subscription_id": sub.id}
                    )
                    notification.message += f"\n\nRenew your subscription here: {renew_url}"
                    notification.save(update_fields=["message"])
                except Exception as e:
                    logger.exception(f"❌ Failed to add renewal link for tenant {tenant.slug}: {e}")

            logger.info(f"✅ Notified tenant '{tenant.slug}' user {user.id} for subscription {sub.id}")



# -------------------------------------------------------------------
#  Verify Paystack transaction asynchronously
# -------------------------------------------------------------------
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
            logger.warning(f"No data for reference {reference}")
            return

        status = data.get("status")
        sub = Subscription.objects.filter(paystack_reference=reference).first()
        if sub and status == "success":
            sub.status = "active"
            sub.started_at = timezone.now()
            duration_days = getattr(sub.plan, "duration_days", 30)
            sub.expires_at = sub.started_at + timezone.timedelta(days=duration_days)
            sub.save(update_fields=["status", "started_at", "expires_at"])
            logger.info(f"✅ Subscription activated for {sub.tenant.slug}")

    except Exception as exc:
        logger.exception(f"❌ Error verifying Paystack transaction {reference}: {exc}")
        raise self.retry(exc=exc)
