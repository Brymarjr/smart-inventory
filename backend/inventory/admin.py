from django.contrib import admin
from .models import Category, Supplier, Product
from core.admin import TenantSafeAdmin
from core.tenant_context import set_current_tenant, clear_current_tenant


@admin.register(Category)
class CategoryAdmin(TenantSafeAdmin):
    list_display = ('name', 'description')
    search_fields = ('name',)


@admin.register(Supplier)
class SupplierAdmin(TenantSafeAdmin):
    list_display = ('name', 'email', 'phone')
    search_fields = ('name', 'email')


@admin.register(Product)
class ProductAdmin(TenantSafeAdmin):
    list_display = ('name', 'sku', 'price', 'quantity', 'reorder_level')
    search_fields = ('name', 'sku')

    #  Remove direct list_filter to avoid tenant context errors
    # list_filter = ('category', 'supplier')

    def get_list_filter(self, request):
        """
        Dynamically apply list filters after setting tenant context.
        """
        user_tenant = getattr(request.user, "tenant", None)
        if user_tenant:
            set_current_tenant(user_tenant)
        else:
            from tenants.models import Tenant
            default_tenant = Tenant.objects.first()
            if default_tenant:
                set_current_tenant(default_tenant)

        try:
            #  Build filters safely inside tenant context
            return ('category', 'supplier')
        finally:
            clear_current_tenant()


