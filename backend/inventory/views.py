from rest_framework import viewsets, permissions
from .models import Category, Supplier, Product
from .serializers import CategorySerializer, SupplierSerializer, ProductSerializer
from users.permissions import (
    IsTenantAdmin,
    IsManager,
    IsStaff,
    IsFinanceOfficer,
    IsTenantAdminOrManager,
    IsTenantAdminManagerOrFinance,
)

# ============================================================
# BASE TENANT VIEWSET
# ============================================================
class BaseTenantViewSet(viewsets.ModelViewSet):
    """
    Reusable base viewset for tenant-aware filtering.
    Ensures that all data is scoped to the authenticated user's tenant.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        model = self.get_serializer().Meta.model

        # Global superuser view (system-wide)
        if user.is_superuser and not getattr(user, "tenant", None):
            return model.objects.all()

        # Tenant-level filtering
        if getattr(user, "tenant", None):
            return model.objects.filter(tenant=user.tenant)

        # No tenant assigned (block access)
        return model.objects.none()

    def perform_create(self, serializer):
        """
        Automatically assign tenant when creating new records.
        """
        tenant = getattr(self.request.user, "tenant", None)
        serializer.save(tenant=tenant)


# ============================================================
# CATEGORY VIEWSET
# ============================================================
class CategoryViewSet(BaseTenantViewSet):
    """
    - TenantAdmin & Manager: full CRUD
    - Staff & FinanceOfficer: read-only
    """
    serializer_class = CategorySerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            # Everyone in tenant can view categories
            return [permissions.IsAuthenticated()]
        # Only admins and managers can create/update/delete
        return [IsTenantAdminOrManager()]


# ============================================================
# SUPPLIER VIEWSET
# ============================================================
class SupplierViewSet(BaseTenantViewSet):
    """
    - TenantAdmin & Manager: full CRUD
    - FinanceOfficer: read-only (can view supplier details)
    - Staff: no access
    """
    serializer_class = SupplierSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [IsTenantAdminManagerOrFinance()]
        return [IsTenantAdminOrManager()]


# ============================================================
# PRODUCT VIEWSET
# ============================================================
class ProductViewSet(BaseTenantViewSet):
    """
    - TenantAdmin & Manager: full CRUD
    - FinanceOfficer: read-only
    - Staff: read-only (for viewing product catalog)
    """
    serializer_class = ProductSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            # Everyone in tenant (including staff) can view product catalog
            return [permissions.IsAuthenticated()]
        # Only TenantAdmin or Manager can modify product details
        return [IsTenantAdminOrManager()]




