from django.db import models
from core.tenant_context import get_current_tenant, TenantNotSetError


class TenantQuerySet(models.QuerySet):
    def for_current_tenant(self):
        try:
            tenant = get_current_tenant()
            if tenant:
                return self.filter(tenant=tenant)
        except TenantNotSetError:
            pass
        return self


class TenantManager(models.Manager):
    def get_queryset(self):
        qs = super().get_queryset()
        try:
            tenant = get_current_tenant()
            if tenant:
                return qs.filter(tenant=tenant)
        except TenantNotSetError:
            # If tenant not set (like in admin, migrations, or system scripts)
            return qs
        return qs


class SafeTenantManager(models.Manager):
    """Manager that enforces tenant isolation, but allows superusers to see all."""

    def get_queryset(self):
        qs = super().get_queryset()

        # Handle tenant-aware filtering only for normal users
        from users.models import User  # import here to avoid circular import

        # Try to get current tenant from thread local or context
        current_tenant = getattr(self, "_current_tenant", None)

        # If a tenant context is set, filter by it
        if current_tenant:
            return qs.filter(tenant=current_tenant)

        # If running inside an authenticated request (ViewSet handles this)
        # no tenant -> show nothing (handled by ViewSet)
        return qs

    def for_user(self, user):
        """Allow easy filtering by user tenant while exempting superusers."""
        qs = super().get_queryset()
        if user.is_superuser:
            return qs  # superuser sees all tenants
        if hasattr(user, "tenant") and user.tenant:
            return qs.filter(tenant=user.tenant)
        return qs.none()