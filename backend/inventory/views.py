# inventory/views.py
from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError, PermissionDenied
from django.db import transaction
from django.shortcuts import get_object_or_404
from core.pagination import StandardResultsSetPagination
from .models import Category, Supplier, Product, InventoryLog
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
    pagination_class = StandardResultsSetPagination
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
    pagination_class = StandardResultsSetPagination
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
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'sku', 'description']

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [permissions.IsAuthenticated()]
        # adjust_stock will fall here, so it is protected automatically
        return [IsTenantAdminOrManager()]
    
    # Filter logic to handle Soft Deletion
    def get_queryset(self):
        # 1. Get base queryset filtered by Tenant
        qs = super().get_queryset()
        
        # FIX: If we are specifically restoring, we MUST look at deleted items
        if self.action == 'restore_product':
            return qs.filter(is_deleted=True)

        # 2. Standard Logic (View Active vs Archived)
        show_deleted = self.request.query_params.get('deleted', 'false')
        
        if show_deleted == 'true':
            return qs.filter(is_deleted=True)
        else:
            return qs.filter(is_deleted=False)

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

    # Custom Action for Stock Adjustment
    # Usage: POST /api/inventory/products/{id}/adjust_stock/
    @action(detail=True, methods=['post'], url_path='adjust-stock')
    def adjust_stock(self, request, pk=None):
        tenant = getattr(request.user, "tenant", None)
        if tenant is None:
            raise PermissionDenied("Tenant context not found.")
        
        # 1. Get Product
        product = self.get_object() # Automatically handles tenant filtering via TenantFilteredViewSet

        # 2. Extract Data
        data = request.data
        reason = data.get('reason', 'correction')
        note = data.get('note', '')

        # 3. Perform Update & Log Atomically
        with transaction.atomic():
            change_amount = 0
            
            if 'quantity_change' in data:
                # Mode A: Delta (-5, +10)
                change_amount = int(data['quantity_change'])
                product.quantity += change_amount
            elif 'new_total' in data:
                # Mode B: Set (Set to 50)
                new_total = int(data['new_total'])
                change_amount = new_total - product.quantity
                product.quantity = new_total
            else:
                return Response(
                    {"error": "Provide 'quantity_change' or 'new_total'"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Save Product
            product.save()

            # Create Audit Log
            InventoryLog.objects.create(
                tenant=tenant,
                product=product,
                user=request.user,
                change_amount=change_amount,
                reason=reason,
                note=note
            )

        return Response({
            "status": "success",
            "new_quantity": product.quantity,
            "message": f"Stock adjusted by {change_amount}"
        })
        
    # ARCHIVE (SOFT DELETE) ACTION
    # POST /api/products/{id}/archive/
    @action(detail=True, methods=['post'], url_path='archive')
    def archive_product(self, request, pk=None):
        product = self.get_object()
        
        reason = request.data.get('reason', 'discontinued')
        note = request.data.get('note', '')

        with transaction.atomic():
            # 1. Mark as deleted
            product.is_deleted = True
            product.save()

            # 2. Log it (So we know WHO deleted it and WHY)
            InventoryLog.objects.create(
                tenant=request.user.tenant,
                product=product,
                user=request.user,
                change_amount=0, # Stock doesn't strictly change, but status does
                reason='correction', # We use 'correction' category for now
                note=f"ARCHIVED: {reason}. {note}"
            )

        return Response({"status": "archived", "message": f"{product.name} has been archived."})   
    
    # RESTORE ACTION
    # POST /api/products/{id}/restore/
    @action(detail=True, methods=['post'], url_path='restore')
    def restore_product(self, request, pk=None):
        product = self.get_object()
        
        with transaction.atomic():
            # 1. Flip the flag
            product.is_deleted = False
            product.save()

            # 2. Log it
            InventoryLog.objects.create(
                tenant=request.user.tenant,
                product=product,
                user=request.user,
                change_amount=0,
                reason='correction', 
                note="RESTORED product from archive."
            )

        return Response({"status": "restored", "message": f"{product.name} has been restored."})