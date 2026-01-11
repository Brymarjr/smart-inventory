from django.core.management.base import BaseCommand
from django.utils import timezone
from billing.models import Subscription, Transaction
from billing.services.paystack import PaystackService
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Auto-correct and synchronize subscription statuses with Paystack transactions."

    def handle(self, *args, **options):
        now = timezone.now()
        self.stdout.write(self.style.MIGRATE_HEADING(f"🔍 Running subscription consistency check at {now}"))
        logger.info("Starting subscription consistency check.")

        updated_count = 0
        expired_count = 0
        verified_count = 0

        # 1️⃣ Expire subscriptions that passed their expiry date
        expired_subs = Subscription.objects.filter(
            status="active",
            expires_at__lt=now
        )
        for sub in expired_subs:
            sub.status = "expired"
            sub.save(update_fields=["status"])
            expired_count += 1
            logger.info(f"⚠️ Subscription {sub.id} ({sub.tenant.slug}) marked expired (past expiry date).")

        # 2️⃣ Check "pending" subscriptions with successful Paystack payments
        pending_subs = Subscription.objects.filter(status="pending", paystack_reference__isnull=False)
        for sub in pending_subs:
            try:
                reference = sub.paystack_reference
                ps_resp = PaystackService.verify_transaction(reference)
                if not ps_resp.get("status"):
                    continue

                data = ps_resp["data"]
                if data["status"] == "success":
                    # ✅ Payment was successful — reactivate subscription
                    plan = sub.plan
                    days = getattr(plan, "duration_days", 30)
                    sub.status = "active"
                    sub.started_at = timezone.now()
                    sub.expires_at = sub.started_at + timezone.timedelta(days=days)
                    sub.save(update_fields=["status", "started_at", "expires_at"])
                    verified_count += 1
                    logger.info(
                        f"✅ Fixed subscription {sub.id} ({sub.tenant.slug}) — marked active "
                        f"until {sub.expires_at} (payment verified)."
                    )

                    # Update transaction status if needed
                    Transaction.objects.filter(reference=reference).update(status="success")

            except Exception as e:
                logger.exception(f"❌ Error verifying subscription {sub.id}: {e}")

        # 3️⃣ Log summary
        updated_count = expired_count + verified_count
        summary = (
            f"\n📊 Subscription Audit Summary:\n"
            f"   - Expired: {expired_count}\n"
            f"   - Reactivated (verified): {verified_count}\n"
            f"   - Total Updated: {updated_count}\n"
        )
        self.stdout.write(self.style.SUCCESS(summary))
        logger.info(summary)
