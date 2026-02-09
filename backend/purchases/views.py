"""
Purchases Views Module.

This module handles the end-to-end Procurement Cycle for the store.

Workflow:
1.  **Creation (Pending):** Staff members create a draft Purchase Order (PO) to request stock.
2.  **Approval (Approved):** A Manager reviews the PO, confirms the cost price with the Supplier, 
    and approves it.
3.  **Payment (Paid):** A Manager confirms payment has been sent. This triggers the 
    **Inventory Update**, which increases stock levels and recalculates product costs.
4.  **Rejection (Cancelled):** A Manager denies the request.

Key Features:
- **Moving Average Cost (MAC):** Automatically recalculates the cost price of products 
  based on the weighted average of old stock vs. new incoming stock.
- **Role-Based Access:** Strict separation between Requestors (Staff) and Approvers (Managers).
"""

from rest_framework import status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from django.utils import timezone
from django.db import transaction
from .models import PurchaseOrder, PurchaseItem
from .serializers import PurchaseOrderSerializer, PurchaseItemSerializer, PurchaseMarkPaidSerializer
from users.permissions import IsStaffOrTenantAdminManager, IsManager, IsTenantAdminOrManager
from inventory.models import Supplier, Product
from core.mixins import TenantFilteredViewSet
from decimal import Decimal
from billing.utils import require_feature
from notifications.utils import notify_user
from core.pagination import StandardResultsSetPagination

class PurchaseOrderViewSet(TenantFilteredViewSet):
    """
    Manages the Lifecycle of a Purchase Order.

    Permissions:
    - **Create:** Allowed for Staff (to request stock).
    - **Approve/Reject/Pay:** Restricted to Managers/Admins.
    - **View:** Scoped to the user's tenant.
    """
    queryset = PurchaseOrder.objects.all().select_related("supplier", "created_by", "approved_by", "paid_by")
    serializer_class = PurchaseOrderSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['reference', 'supplier__name', 'status', 'notes']

    def get_queryset(self):
        """
        Returns Purchase Orders belonging to the authenticated user's tenant.
        Superusers can view all POs globally.
        """
        user = self.request.user
        base_qs = PurchaseOrder.objects.select_related(
            "supplier", "created_by", "approved_by", "paid_by"
        )
        if user.is_superuser:
            return base_qs
        return base_qs.filter(tenant=user.tenant)

    def perform_create(self, serializer):
        """
        Creates a Draft PO.
        
        Enforces the 'purchases' feature flag from the billing plan.
        """
        tenant = getattr(self.request.user, "tenant", None)
        if tenant is None:
            raise PermissionDenied("Tenant context not found.")
        require_feature(tenant, "purchases")
        serializer.save(tenant=tenant, created_by=self.request.user)

    def list(self, request, *args, **kwargs):
        tenant = getattr(request.user, "tenant", None)
        if tenant is None:
            return Response({"detail": "Tenant context not found."}, status=status.HTTP_403_FORBIDDEN)
        require_feature(tenant, "purchases")
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs): 
        tenant = getattr(request.user, "tenant", None)
        if tenant is None:
            return Response({"detail": "Tenant context not found."}, status=status.HTTP_403_FORBIDDEN)
        require_feature(tenant, "purchases")
        return super().retrieve(request, *args, **kwargs)

    # ----------------------
    # Custom Actions
    # ----------------------

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated, IsManager])
    def approve(self, request, pk=None):
        """
        Step 2: Manager Approval.
        
        Transitions status from 'Pending' -> 'Approved (Pending Payment)'.
        
        **Critical Input:**
        The Manager MUST provide the confirmed `unit_cost` for every item in the PO.
        This locks in the cost price before payment is made.

        Payload Example:
        {
            "supplier": 5,
            "items": [
                {"id": 10, "unit_cost": 150.00},
                {"id": 11, "unit_cost": 200.00}
            ]
        }
        """
        tenant = getattr(self.request.user, "tenant", None)
        if tenant is None:
            return Response({"detail": "Tenant context not found."}, status=status.HTTP_403_FORBIDDEN)

        require_feature(tenant, "purchases")
        purchase = self.get_object()

        if purchase.status != PurchaseOrder.STATUS_PENDING:
            return Response({"detail": "Only pending orders can be approved."}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Validate Supplier (if not already set)
        supplier_id = request.data.get("supplier")
        if not supplier_id:
            if not purchase.supplier:
                return Response({"detail": "Supplier must be provided."}, status=status.HTTP_400_BAD_REQUEST)
        else:
            try:
                purchase.supplier = Supplier.objects.get(id=supplier_id)
            except Supplier.DoesNotExist:
                return Response({"detail": "Invalid supplier ID."}, status=status.HTTP_400_BAD_REQUEST)

        # 2. Validate Incoming Costs
        incoming_items = request.data.get("items")
        if not isinstance(incoming_items, list) or len(incoming_items) == 0:
            return Response(
                {"detail": "You must provide an 'items' list with each item's id and unit_cost."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Build Map { item_id: unit_cost }
        cost_map = {}
        for it in incoming_items:
            try:
                cost_map[int(it['id'])] = Decimal(str(it['unit_cost']))
            except (ValueError, KeyError, TypeError):
                continue

        # Ensure EVERY item in the PO has a cost provided
        po_item_ids = {item.id for item in purchase.items.all()}
        missing_ids = po_item_ids - set(cost_map.keys())
        
        if missing_ids:
            return Response(
                {"detail": f"Missing unit_cost for item IDs: {sorted(missing_ids)}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 3. Save Costs, Recalculate Total, Update Status
        with transaction.atomic():
            total_po_amount = Decimal(0)
            
            for item in purchase.items.all():
                new_cost = cost_map[item.id]
                item.unit_cost = new_cost
                item.save() # This triggers save() which updates subtotal
                total_po_amount += item.subtotal

            purchase.total_amount = total_po_amount
            purchase.status = PurchaseOrder.STATUS_APPROVED_PENDING_PAYMENT
            purchase.approved_by = request.user
            purchase.approved_at = timezone.now()
            purchase.save()

        # Notify
        notify_user(
            tenant=purchase.tenant,
            recipient=purchase.created_by,
            title="Purchase Approved",
            message=f"PO #{purchase.reference} approved. Total cost: {purchase.total_amount}",
            notification_type="purchase_approved",
        )

        serializer = self.get_serializer(purchase)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated, IsManager])
    def reject(self, request, pk=None):
        """
        Step 2b: Rejection.
        
        Transitions status to 'Cancelled'.
        No inventory changes occur.
        """
        tenant = getattr(self.request.user, "tenant", None)
        if tenant is None:
            return Response({"detail": "Tenant context not found."}, status=status.HTTP_403_FORBIDDEN)

        require_feature(tenant, "purchases")
        purchase = self.get_object()
        if purchase.status not in [PurchaseOrder.STATUS_PENDING, PurchaseOrder.STATUS_APPROVED_PENDING_PAYMENT]:
            return Response({"detail": "Only pending or approved orders can be rejected."}, status=status.HTTP_400_BAD_REQUEST)

        purchase.status = PurchaseOrder.STATUS_CANCELLED
        purchase.save()
        
        notify_user(
            tenant=purchase.tenant,
            recipient=purchase.created_by,
            title="Purchase Rejected",
            message=f"Your purchase order #{purchase.reference} has been rejected.",
            notification_type="purchase_rejected",
        )

        serializer = self.get_serializer(purchase)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated, IsManager], serializer_class=PurchaseMarkPaidSerializer)
    def mark_paid(self, request, pk=None):
        """
        Step 3: Payment Confirmation & Inventory Update.
        
        Transitions status from 'Approved' -> 'Paid'.
        
        **Side Effects (The "Magic"):**
        1.  **Updates Inventory Quantity:** Adds the PO items to current stock.
        2.  **Calculates Moving Average Cost (MAC):** Updates the product's cost price based on the weighted average of existing stock 
            and new incoming stock.
            
            `New Cost = ((Old Qty * Old Cost) + (New Qty * New Cost)) / Total Qty`
        
        3.  **Updates Selling Price:** Optionally updates the retail price if provided.
        """
        tenant = getattr(self.request.user, "tenant", None)
        if tenant is None:
            return Response({"detail": "Tenant context not found."}, status=status.HTTP_403_FORBIDDEN)

        require_feature(tenant, "purchases")
        purchase = self.get_object()

        if purchase.status != PurchaseOrder.STATUS_APPROVED_PENDING_PAYMENT:
            return Response({"detail": "Only approved orders can be marked as paid."}, status=status.HTTP_400_BAD_REQUEST)

        # --- VALIDATION ---
        incoming_items = request.data.get("items")
        if not isinstance(incoming_items, list) or len(incoming_items) == 0:
            return Response({"detail": "You must provide an 'items' list with each item's id and new_price."}, status=status.HTTP_400_BAD_REQUEST)

        incoming_map = {}
        provided_ids = set()
        invalid_price_for = []
        
        for it in incoming_items:
            try:
                item_id = int(it.get("id"))
                provided_ids.add(item_id)
                raw = it.get("new_price")
                if raw in (None, "", "null"):
                    invalid_price_for.append(item_id)
                    continue
                incoming_map[item_id] = Decimal(str(raw))
            except (TypeError, ValueError):
                continue

        purchase_item_ids = {i.id for i in purchase.items.all()}
        missing = purchase_item_ids - provided_ids
        
        if missing:
            return Response({"detail": f"Missing new_price for item ids: {sorted(missing)}"}, status=status.HTTP_400_BAD_REQUEST)
        if invalid_price_for:
            return Response({"detail": f"Invalid new_price for item ids: {sorted(invalid_price_for)}"}, status=status.HTTP_400_BAD_REQUEST)

        # --- EXECUTION ---
        with transaction.atomic():
            purchase.status = PurchaseOrder.STATUS_PAID
            purchase.paid_by = request.user
            purchase.paid_at = timezone.now()
            purchase.save(update_fields=["status", "paid_by", "paid_at"])

            for item in purchase.items.select_related("product").all():
                product = item.product
                
                # 1. Calculate Moving Average Cost (MAC)
                current_qty = product.quantity
                current_cost = product.cost_price
                incoming_qty = item.quantity
                incoming_cost = item.unit_cost  # Guaranteed to be set from 'approve' step

                if incoming_cost is None:
                      # Safety catch if data is corrupt
                      raise ValueError(f"Item {item.id} has no unit_cost set.")

                new_total_qty = current_qty + incoming_qty

                if new_total_qty > 0:
                    # MAC Formula: Weighted Average
                    total_value = (current_qty * current_cost) + (incoming_qty * incoming_cost)
                    product.cost_price = total_value / new_total_qty  
                
                # 2. Update Selling Price
                if item.id in incoming_map:
                    item.new_price = incoming_map[item.id]
                    item.save(update_fields=["new_price"])
                    product.price = item.new_price 

                # 3. Update Quantity
                product.quantity = new_total_qty
                product.save(update_fields=["price", "quantity", "cost_price"])

        notify_user(
            tenant=purchase.tenant,
            recipient=purchase.created_by,
            title="Purchase Paid",
            message=f"PO #{purchase.reference} paid. Inventory updated.",
            notification_type="purchase_paid",
        )

        serializer = self.get_serializer(purchase)
        return Response(serializer.data, status=status.HTTP_200_OK)


class PurchaseItemViewSet(TenantFilteredViewSet):
    """
    Read-Only view for items inside a Purchase Order.
    Used mainly by the frontend to display line items when viewing PO details.
    """
    queryset = PurchaseItem.objects.none()
    serializer_class = PurchaseItemSerializer
    pagination_class = StandardResultsSetPagination
    permission_classes = [IsAuthenticated, IsTenantAdminOrManager]

    def get_queryset(self):
        user = self.request.user
        base_qs = PurchaseItem.objects.select_related("purchase", "product")
        if user.is_superuser:
            return base_qs
        return base_qs.filter(purchase__tenant=user.tenant)
    
    def list(self, request, *args, **kwargs):
        tenant = getattr(request.user, "tenant", None)
        if tenant is None:
            return Response({"detail": "Tenant context not found."}, status=status.HTTP_403_FORBIDDEN)
        require_feature(tenant, "purchases")
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        tenant = getattr(request.user, "tenant", None)
        if tenant is None:
            return Response({"detail": "Tenant context not found."}, status=status.HTTP_403_FORBIDDEN)
        require_feature(tenant, "purchases")
        return super().retrieve(request, *args, **kwargs)