# backend/billing/signals.py
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db import transaction
from django.utils import timezone
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)

from tenants.models import Tenant

from billing.models import Subscription, Plan

@receiver(post_save, sender=Tenant)
def create_or_ensure_free_trial(sender, instance, created, **kwargs):
    """
    Hybrid onboarding: ensure new tenants get a Free trial automatically.
    Defenses:
      - Skips during migrations / when DB/tables not ready (OperationalError, ProgrammingError).
      - Avoids duplicate active/free subscriptions.
      - If 'Free' Plan is missing, will attempt to create a minimal Free plan on-the-fly.
    """
    if not created:
        return

    try:
        # Quick guard: if there is already an active/pending subscription, don't create another.
        existing = Subscription.objects.filter(tenant=instance).exclude(status="cancelled").exists()
        if existing:
            logger.info("Tenant %s already has a subscription; skipping auto-free creation.", instance.slug)
            return

        free_plan = Plan.objects.filter(name__iexact="free").first()

        # If the free plan doesn't exist yet (race with plan seeding), try to create it minimally.
        if not free_plan:
            logger.warning("Free plan not found, attempting to create a minimal Free plan on-the-fly.")
            try:
                free_plan = Plan.objects.create(
                    name="Free",
                    amount=0,
                    currency="NGN",
                    duration_days=30,
                    description="Auto-created Free trial plan (30 days).",
                    is_active=True,
                )
                logger.info("Minimal Free plan created on-the-fly.")
            except Exception as e:
                # If creation fails (DB not ready), log and exit gracefully.
                logger.exception("Failed to create on-the-fly Free plan: %s. Skipping free trial creation.", e)
                return

        # Create subscription atomically to avoid race conditions.
        with transaction.atomic():
            # Re-check inside transaction to avoid duplicates
            if Subscription.objects.filter(tenant=instance, status__in=["active", "pending"]).exists():
                logger.info("Tenant %s got a subscription concurrently; skipping creation.", instance.slug)
                return

            expires_at = timezone.now() + timedelta(days=getattr(free_plan, "duration_days", 30))

            sub = Subscription.objects.create(
                tenant=instance,
                plan=free_plan,
                status="active",
                started_at=timezone.now(),
                expires_at=expires_at,
                paystack_reference="FREE-AUTO",
                auto_renew=False,
            )

            logger.info("✅ Created free trial subscription %s for tenant '%s' (expires %s).", sub.id, instance.slug, expires_at)

    except (Exception,) as exc:
        # Catch-all to ensure signal never crashes tenant creation; log details for debugging.
        logger.exception("Unexpected error in create_or_ensure_free_trial for tenant %s: %s", getattr(instance, "slug", None), exc)
        return

