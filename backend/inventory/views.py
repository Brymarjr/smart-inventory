# inventory/views.py
from rest_framework import viewsets, permissions, filters
from rest_framework.exceptions import ValidationError, PermissionDenied
from .models import Category, Supplier, Product
from .serializers import CategorySerializer, SupplierSerializer, ProductSerializer
from users.permissions import (
    IsTenantAdminOrManager,
)
from billing.utils import require_feature, check_plan_limit
from core.mixins import TenantFilteredViewSet



# ============================================================
# CATEGORY VIEWSET
# ============================================================
class CategoryViewSet(TenantFilteredViewSet):
    """
    - TenantAdmin & Manager: full CRUD
    - Staff: read-only
    - Restricted by tenant plan (requires 'inventory_view' feature)
    """
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    
    filter_backends = [filters.SearchFilter]
    search_fields = ['name']

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
    - Staff: no access
    - Restricted by tenant plan (requires 'inventory_view')
    """
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'email']

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

        current_count = Supplier.objects.filter(tenant=tenant).count()
        check_plan_limit(tenant, "max_suppliers", current_count)

        return super().create(request, *args, **kwargs)


# ============================================================
# PRODUCT VIEWSET
# ============================================================
class ProductViewSet(TenantFilteredViewSet):
    """
    - TenantAdmin & Manager: full CRUD
    - Staff: read-only (for viewing product catalog)
    - Restricted by tenant plan (requires 'inventory_view')
    """
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'sku', 'description']

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