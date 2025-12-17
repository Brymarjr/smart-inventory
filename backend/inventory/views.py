# inventory/views.py
from rest_framework import viewsets, permissions
from rest_framework.exceptions import ValidationError, PermissionDenied
from .models import Category, Supplier, Product
from .serializers import CategorySerializer, SupplierSerializer, ProductSerializer
from users.permissions import (
    IsTenantAdminOrManager,
    IsTenantAdminManagerOrFinance,
)
from billing.utils import require_feature, check_plan_limit
from core.mixins import TenantFilteredViewSet



# ============================================================
# CATEGORY VIEWSET
# ============================================================
class CategoryViewSet(TenantFilteredViewSet):
    """
    - TenantAdmin & Manager: full CRUD
    - Staff & FinanceOfficer: read-only
    - Restricted by tenant plan (requires 'inventory_view' feature)
    """
    serializer_class = CategorySerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [permissions.IsAuthenticated()]
        return [IsTenantAdminOrManager()]

    def list(self, request, *args, **kwargs):
        tenant = getattr(request.user, "tenant", None)
        if tenant is None:
            raise PermissionDenied("Tenant context not found.")

        require_feature(tenant, "inventory_view")
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        tenant = getattr(request.user, "tenant", None)
        if tenant is None:
            raise PermissionDenied("Tenant context not found.")

        require_feature(tenant, "inventory_view")

        current_count = Category.objects.filter(tenant=tenant).count()
        check_plan_limit(tenant, "max_categories", current_count)

        return super().create(request, *args, **kwargs)



# ============================================================
# SUPPLIER VIEWSET
# ============================================================
class SupplierViewSet(TenantFilteredViewSet):
    """
    - TenantAdmin & Manager: full CRUD
    - FinanceOfficer: read-only (can view supplier details)
    - Staff: no access
    - Restricted by tenant plan (requires 'inventory_view')
    """
    serializer_class = SupplierSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [permissions.IsAuthenticated()]
        return [IsTenantAdminManagerOrFinance()]

    def list(self, request, *args, **kwargs):
        tenant = getattr(request.user, "tenant", None)
        if tenant is None:
            raise PermissionDenied("Tenant context not found.")

        require_feature(tenant, "inventory_view")
        return super().list(request, *args, **kwargs)


    def create(self, request, *args, **kwargs):
        tenant = getattr(request.user, "tenant", None)
        if tenant is None:
            raise PermissionDenied("Tenant context not found.")

        require_feature(tenant, "inventory_view")

        current_count = Supplier.objects.filter(tenant=tenant).count()
        check_plan_limit(tenant, "max_suppliers", current_count)

        return super().create(request, *args, **kwargs)



# ============================================================
# PRODUCT VIEWSET
# ============================================================
class ProductViewSet(TenantFilteredViewSet):
    """
    - TenantAdmin & Manager: full CRUD
    - FinanceOfficer: read-only
    - Staff: read-only (for viewing product catalog)
    - Restricted by tenant plan (requires 'inventory_view')
    """
    serializer_class = ProductSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [permissions.IsAuthenticated()]
        return [IsTenantAdminOrManager()]

    def list(self, request, *args, **kwargs):
        tenant = getattr(request.user, "tenant", None)
        if tenant is None:
            raise PermissionDenied("Tenant context not found.")

        require_feature(tenant, "inventory_view")
        return super().list(request, *args, **kwargs)


    def create(self, request, *args, **kwargs):
        tenant = getattr(request.user, "tenant", None)
        if tenant is None:
            raise PermissionDenied("Tenant context not found.")

        require_feature(tenant, "inventory_view")

        current_count = Product.objects.filter(tenant=tenant).count()
        check_plan_limit(tenant, "max_products", current_count)

        return super().create(request, *args, **kwargs)

