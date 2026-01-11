# backend/billing/signals.py
from django.db.models.signals import post_save
from django.db.models.signals import post_migrate
from django.dispatch import receiver
from django.db import transaction
from django.utils import timezone
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)

from tenants.models import Tenant
from billing.models import Subscription, Plan


# -------------------------------
# Auto-create default plans
# -------------------------------
@receiver(post_migrate)
def ensure_default_plans(sender, **kwargs):
    if sender.name != "billing":
        return

    try:
        if not Plan.objects.exists():
            plans = [
                Plan(
                    name="Free",
                    amount=0,
                    currency="NGN",
                    duration_days=30,
                    description="Basic free tier with limited users and features.",
                    is_active=True,
                ),
                Plan(
                    name="Pro",
                    amount=5000,
                    currency="NGN",
                    duration_days=30,
                    description="Pro plan with advanced features and up to 50 users.",
                    is_active=True,
                ),
                Plan(
                    name="Enterprise",
                    amount=15000,
                    currency="NGN",
                    duration_days=30,
                    description="Enterprise tier with unlimited users, reports, and premium support.",
                    is_active=True,
                ),
            ]
            Plan.objects.bulk_create(plans)
            logger.info(" Default plans created successfully.")
        else:
            logger.info(" Plans already exist — skipping auto-creation.")
    except Exception as e:
        logger.exception("Failed to create default plans: %s", e)


# -------------------------------
# Auto-create free trial for new tenants
# -------------------------------
@receiver(post_save, sender=Tenant)
def create_or_ensure_free_trial(sender, instance, created, **kwargs):
    if not created:
        return

    try:
        # Skip if an active/pending subscription already exists
        if Subscription.objects.filter(tenant=instance).exclude(status="cancelled").exists():
            logger.info("Tenant %s already has a subscription; skipping free trial.", instance.slug)
            return

        free_plan = Plan.objects.filter(name__iexact="free").first()
        if not free_plan:
            # Create minimal Free plan on-the-fly if missing
            free_plan = Plan.objects.create(
                name="Free",
                amount=0,
                currency="NGN",
                duration_days=30,
                description="Auto-created Free trial plan (30 days).",
                is_active=True,
            )
            logger.info("Minimal Free plan created on-the-fly.")

        with transaction.atomic():
            # Avoid race-condition duplicates
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

            logger.info(
                " Created free trial subscription %s for tenant '%s' (expires %s).",
                sub.id,
                instance.slug,
                expires_at,
            )

    except Exception as exc:
        logger.exception("Unexpected error in create_or_ensure_free_trial for tenant %s: %s", getattr(instance, "slug", None), exc)
