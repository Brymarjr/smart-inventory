import requests
import os
from django.core.mail import send_mail
from django.conf import settings
from rest_framework.exceptions import ValidationError, PermissionDenied
from billing.constants import PLAN_FEATURES, PLAN_LIMITS
from django.utils import timezone
from django.db import transaction
from billing.models import Subscription, Plan

PAYSTACK_SECRET_KEY = os.getenv("PAYSTACK_SECRET_KEY", "")
PAYSTACK_BASE_URL = os.getenv("PAYSTACK_BASE_URL", "https://api.paystack.co")


def send_billing_alert_email(subject, message, recipients):
    """
    Simple helper to send billing-related emails.
    """
    send_mail(
        subject=subject,
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=recipients,
        fail_silently=False,
    )


def get_tenant_plan(tenant):
    """
    Return the tenant's plan name (fallback to 'free').
    Superusers (without a tenant) should always get 'enterprise' privileges.
    """
    from billing.models import Subscription  # avoid circular import

    # Handle None or global superuser access
    if tenant is None:
        return 'enterprise'

    try:
        # Fetch the latest active subscription safely
        active_sub = (
            Subscription.objects
            .filter(tenant=tenant, status="active")
            .order_by("-created_at")
            .first()
        )
        if active_sub and active_sub.plan:
            return active_sub.plan.name.lower()
    except Exception as e:
        # Optional: you can log this
        print(f"[get_tenant_plan error] {e}")

    return 'free'


def has_feature(tenant, feature: str) -> bool:
    """Check if the tenant's plan includes a feature."""
    plan_name = get_tenant_plan(tenant)
    return feature in PLAN_FEATURES.get(plan_name, [])


def check_plan_limit(tenant, limit_key: str, current_count: int):
    """
    Enforce plan limits dynamically.
    Example usage: check_plan_limit(tenant, 'max_products', Product.objects.count())
    """
    plan_name = get_tenant_plan(tenant)
    limit = PLAN_LIMITS.get(plan_name, {}).get(limit_key)
    if limit is not None and current_count >= limit:
        raise ValidationError(f"You've reached your plan limit for {limit_key.replace('_', ' ')} ({limit}).")


def require_feature(tenant, feature: str):
    """Raise PermissionDenied if tenant does not have the feature."""
    # Superusers or global access bypass restriction
    if tenant is None:
        return

    if not has_feature(tenant, feature):
        raise PermissionDenied(f"Your current plan does not include '{feature}'. Upgrade to access this feature.")


def create_paid_subscription(tenant, plan_tier_name, paystack_reference=None, auto_renew=True, amount=None):
    """
    Promote or create a paid subscription for a tenant.
    - Cancels any existing active subscriptions (including Free).
    - Creates new paid subscription as active.
    - Returns the created Subscription.
    """
    plan = Plan.objects.filter(name__iexact=plan_tier_name).first()
    if not plan:
        raise ValueError(f"Plan not found: {plan_tier_name}")

    with transaction.atomic():
        # Normalize and cancel all active subscriptions
        cancelled_count = Subscription.objects.filter(
            tenant=tenant,
            status__iexact="active"   # <-- case-insensitive just in case
        ).update(status="cancelled")

        if cancelled_count:
            print(f"🔁 {cancelled_count} active subscription(s) cancelled for tenant '{tenant.slug}'")

        # Create the new paid subscription
        expires_at = timezone.now() + timezone.timedelta(days=plan.duration_days)
        sub = Subscription.objects.create(
            tenant=tenant,
            plan=plan,
            status="active",
            started_at=timezone.now(),
            expires_at=expires_at,
            paystack_reference=paystack_reference,
            auto_renew=auto_renew,
        )

        print(f"✅ Created new {plan_tier_name} subscription for tenant '{tenant.slug}'")

        return sub
