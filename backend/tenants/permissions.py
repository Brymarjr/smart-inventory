from rest_framework.permissions import BasePermission, SAFE_METHODS
from django.utils import timezone
from billing.models import Subscription

class IsTenantActiveOrReadOnly(BasePermission):
    """
    Allow safe methods for everyone (GET, HEAD, OPTIONS).
    For unsafe methods (POST, PUT, PATCH, DELETE), only allow if the tenant's subscription is active.
    Assumes request.user has a relation to tenant via profile or request.tenant is set by middleware.
    """

    message = "Your tenant's subscription is expired or past due. Write operations are disabled."

    def has_permission(self, request, view):
        # Allow safe methods
        if request.method in SAFE_METHODS:
            return True

        # Determine tenant: common patterns:
        # 1) If you attach tenant to request (middleware), use request.tenant
        tenant = getattr(request, "tenant", None)

        # 2) Fallback: try to infer from user's profile
        if not tenant and hasattr(request.user, "tenant"):
            tenant = getattr(request.user, "tenant", None)

        if not tenant:
            # if no tenant found, deny for safety
            return False

        # Check subscription active
        active = Subscription.objects.filter(
            tenant=tenant,
            status="active",
            expires_at__gte=timezone.now()
        ).exists()

        return active
