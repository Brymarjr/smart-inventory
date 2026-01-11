from django.contrib import admin
from core.tenant_context import set_current_tenant, clear_current_tenant
from tenants.models import Tenant


class TenantSafeAdmin(admin.ModelAdmin):
    """Base admin that filters by tenant but allows superusers to see all."""

    def get_queryset(self, request):
        qs = super().get_queryset(request)

        # ✅ Superuser sees all tenant data
        if request.user.is_superuser:
            return qs

        # ✅ Tenant users see only their tenant data
        user_tenant = getattr(request.user, "tenant", None)
        if user_tenant:
            return qs.filter(tenant=user_tenant)

        # No tenant assigned → return empty queryset
        return qs.none()

    def save_model(self, request, obj, form, change):
        """Automatically assign tenant when tenant user creates objects."""
        if not request.user.is_superuser:
            user_tenant = getattr(request.user, "tenant", None)
            if user_tenant:
                obj.tenant = user_tenant
        obj.save()
