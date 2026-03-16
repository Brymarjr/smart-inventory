"""
Inventory Views Module.

This module manages the core inventory entities: Categories, Suppliers, and Products.
It enforces strict multi-tenant isolation, plan limits (e.g., Max 50 products),
and role-based access control.

Key Features:
1.  **Audit Logging:** All critical changes (Updates, Deletes, Stock Adjustments) are
    automatically logged to the `AuditLog` or `InventoryLog` tables.
2.  **Plan Enforcement:** Checks if the tenant has reached their quota before allowing creation.
3.  **Soft Deletion:** Products are "Archived" instead of deleted to preserve sales history.
4.  **Stock Adjustment:** A dedicated, transactional endpoint for reconciling inventory counts.
"""

from rest_framework import permissions, filters, status
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
from tenants.models import AuditLog

class AuditLogMixin:
    """
    Mixin to automatically record Audit Logs for destructive actions.
    
    Overrides `perform_update` and `perform_destroy` to intercept the request,
    require a 'reason' field, and create a log entry in `AuditLog` before
    committing the change to the database.
    """
    def perform_update(self, serializer):
        # 1. Get the reason from the request (Required for compliance)
        reason = self.request.data.get('reason', '').strip()
        if not reason:
            raise ValidationError({"reason": "A reason is required for updates."})

        # 2. Save the update
        instance = serializer.save()

        # 3. Create Audit Log
        AuditLog.objects.create(
            tenant=self.request.tenant,
            actor=self.request.user,
            action='UPDATE',
            target_model=instance.__class__.__name__,
            target_name=str(instance),
            reason=reason
        )

    def perform_destroy(self, instance):
        # 1. Get reason (For DELETE, data might be in query params or body)
        reason = self.request.data.get('reason', self.request.query_params.get('reason', '')).strip()
        
        if not reason:
            raise ValidationError({"reason": "A reason is required for deletion."})

        # 2. Create Audit Log BEFORE deleting (so we capture the name before it vanishes)
        AuditLog.objects.create(
            tenant=self.request.tenant,
            actor=self.request.user,
            action='DELETE',
            target_model=instance.__class__.__name__,
            target_name=str(instance),
            reason=reason
        )

        # 3. Delete
        instance.delete()

# ============================================================
# CATEGORY VIEWSET
# ============================================================
class CategoryViewSet(AuditLogMixin, TenantFilteredViewSet):
    """
    Manages Product Categories (e.g., 'Electronics', 'Groceries').

    Access Control:
    - Tenant Admin/Manager: Full Create/Update/Delete access.
    - Staff: Read-Only access.
    - Plan Check: Requires 'inventory_view' feature and checks 'max_categories' limit.
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
        """
        List categories for the current tenant.
        Gated by 'inventory_view' feature.
        """
        tenant = getattr(request.user, "tenant", None)
        if tenant is None:
            raise PermissionDenied("Tenant context not found.")

        require_feature(tenant, "inventory_basic")
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        """
        Create a new category.
        
        Enforces:
        1. Feature presence ('inventory_basic').
        2. Plan Usage Limits ('max_categories').
        """
        tenant = getattr(request.user, "tenant", None)
        if tenant is None:
            raise PermissionDenied("Tenant context not found.")

        require_feature(tenant, "inventory_basic")

        current_count = Category.objects.filter(tenant=tenant).count()
        check_plan_limit(tenant, "max_categories", current_count)

        return super().create(request, *args, **kwargs)


# ============================================================
# SUPPLIER VIEWSET
# ============================================================
class SupplierViewSet(AuditLogMixin, TenantFilteredViewSet):
    """
    Manages External Suppliers/Vendors.

    Access Control:
    - Tenant Admin/Manager: Full Access.
    - Staff: No access (typically sensitive business info).
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

        require_feature(tenant, "inventory_basic")
        return super().list(request, *args, **kwargs)


    def create(self, request, *args, **kwargs):
        """
        Create a new Supplier.
        
        Enforces 'max_suppliers' plan limit.
        """
        tenant = getattr(request.user, "tenant", None)
        if tenant is None:
            raise PermissionDenied("Tenant context not found.")

        require_feature(tenant, "inventory_basic")

        current_count = Supplier.objects.filter(tenant=tenant).count()
        check_plan_limit(tenant, "max_suppliers", current_count)

        return super().create(request, *args, **kwargs)


# ============================================================
# PRODUCT VIEWSET
# ============================================================
class ProductViewSet(AuditLogMixin, TenantFilteredViewSet):
    """
    Manages the Product Catalog.

    This is the central entity of the system. It handles:
    - CRUD operations for products.
    - Soft Deletion (Archiving) vs Hard Deletion.
    - Stock Level Adjustments (Stock-taking).
    """
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'sku', 'description']

    def get_permissions(self):
        """
        - List/Retrieve: Open to all authenticated store staff.
        - Create/Update/Delete: Restricted to Admins/Managers.
        - Adjust Stock: Also restricted (via IsTenantAdminOrManager).
        """
        if self.action in ["list", "retrieve"]:
            return [permissions.IsAuthenticated()]
        # adjust_stock will fall here, so it is protected automatically
        return [IsTenantAdminOrManager()]
    
    # Filter logic to handle Soft Deletion
    def get_queryset(self):
        """
        Custom QuerySet logic to handle Soft Deletion.
        
        - Normal List: Returns ONLY active products.
        - '?deleted=true': Returns ONLY archived products.
        - Restore Action: Must access archived products to restore them.
        """
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

        require_feature(tenant, "inventory_basic")
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        """
        Create a new Product.
        Enforces 'max_products' limit based on the subscription tier.
        """
        tenant = getattr(request.user, "tenant", None)
        if tenant is None:
            raise PermissionDenied("Tenant context not found.")

        require_feature(tenant, "inventory_basic")

        current_count = Product.objects.filter(tenant=tenant).count()
        check_plan_limit(tenant, "max_products", current_count)

        return super().create(request, *args, **kwargs)
    
    def perform_update(self, serializer):
        """
        Intercepts standard PUT/PATCH requests to edit a product.
        Records what specifically changed (e.g., Name or Reorder Level) 
        and creates a global AuditLog entry.
        """
        from django.db import transaction
        from tenants.models import AuditLog 

        # 1. Capture the old data directly from the instance before saving
        old_instance = self.get_object()
        old_name = old_instance.name
        old_reorder = getattr(old_instance, 'reorder_level', None)
        old_price = getattr(old_instance, 'price', None)

        # Extract the manual note provided by the admin in the frontend modal
        frontend_note = self.request.data.get('note', '').strip()

        # 2. Save the new data atomically alongside the log
        with transaction.atomic():
            updated_product = serializer.save()

            # 3. Auto-generate the change summary
            changes = []
            if old_name != updated_product.name:
                changes.append(f"Name: '{old_name}' -> '{updated_product.name}'")
            if old_reorder != updated_product.reorder_level:
                changes.append(f"Reorder: {old_reorder} -> {updated_product.reorder_level}")
            if old_price != updated_product.price:
                changes.append(f"Price: {old_price} -> {updated_product.price}")
            
            change_summary = " | ".join(changes) if changes else "General details updated."
            
            # Combine the automatic summary with the user's manual note
            final_reason = change_summary
            if frontend_note:
                final_reason += f" - Admin Note: {frontend_note}"

            # 4. Create the Global Audit Log
            AuditLog.objects.create(
                tenant=self.request.user.tenant,
                actor=self.request.user,
                action='UPDATE',
                target_model='Product',
                target_name=updated_product.name,
                reason=final_reason
            )
            
    # Custom Action for Stock Adjustment
    # Usage: POST /api/inventory/products/{id}/adjust_stock/
    @action(detail=True, methods=['post'], url_path='adjust-stock')
    def adjust_stock(self, request, pk=None):
        """
        Manually correct stock levels (Stock Taking).

        Supports two modes:
        1. **Delta:** Add/Remove quantity (e.g., `quantity_change: -5` for damage).
        2. **Set:** Force a specific value (e.g., `new_total: 50` after physical count).

        Wraps the update and the log creation in an atomic transaction to ensure
        data integrity.
        """
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
        """
        Soft-deletes a product.
        
        Does not remove the record from DB (to preserve sales history).
        Sets `is_deleted=True` and logs the action.
        """
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
        """
        Restores a previously archived product.
        
        Sets `is_deleted=False` to make it visible in sales and lists again.
        """
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