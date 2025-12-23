from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from django.utils import timezone
from django.db import transaction
from .models import PurchaseOrder, PurchaseItem
from .serializers import PurchaseOrderSerializer, PurchaseItemSerializer, PurchaseMarkPaidSerializer
from users.permissions import IsFinanceOfficer, IsTenantAdminManagerOrFinance, IsStaffOrTenantAdminManagerOrFinance
from inventory.models import Supplier, Product
from core.mixins import TenantFilteredViewSet
from decimal import Decimal
from billing.utils import require_feature
from notifications.utils import notify_user





class PurchaseOrderViewSet(TenantFilteredViewSet):
    """
    Handles purchase order creation, approval, rejection, and payment confirmation.
    Permissions:
      - Staff: can create new purchase orders (pending)
      - Finance Officer: can approve, reject, and mark as paid
      - TenantAdmin: full control
    """
    # Safe default to avoid TenantNotSetError during import
    queryset = PurchaseOrder.objects.all().select_related("supplier", "created_by", "approved_by", "paid_by")
    serializer_class = PurchaseOrderSerializer
    permission_classes = [IsAuthenticated, IsStaffOrTenantAdminManagerOrFinance]

    def get_queryset(self):
        """
        Restrict results to the user's tenant only.
        Evaluated lazily at request time (tenant context exists here).
        """
        user = self.request.user
        base_qs = PurchaseOrder.objects.select_related(
            "supplier", "created_by", "approved_by", "paid_by"
        )
        if user.is_superuser:
            return base_qs
        return base_qs.filter(tenant=user.tenant)

    def perform_create(self, serializer):
        """Attach tenant and creator on purchase creation."""
        tenant = getattr(self.request.user, "tenant", None)
        if tenant is None:
            raise PermissionDenied("Tenant context not found.")

        require_feature(tenant, "purchases")
        serializer.save(tenant=tenant, created_by=self.request.user)

        
    def list(self, request, *args, **kwargs):
        """List purchase orders, restricted by plan and tenant."""
        tenant = getattr(request.user, "tenant", None)
        if tenant is None:
            return Response(
                {"detail": "Tenant context not found."},
                status=status.HTTP_403_FORBIDDEN,
            )

        require_feature(tenant, "purchases")
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs): 
        """Retrieve a single purchase order."""
        tenant = getattr(request.user, "tenant", None)
        if tenant is None:
            return Response(
                {"detail": "Tenant context not found."},
                status=status.HTTP_403_FORBIDDEN,
            )

        require_feature(tenant, "purchases")
        return super().retrieve(request, *args, **kwargs)


    # ----------------------
    # Custom Actions
    # ----------------------

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated, IsFinanceOfficer])
    def approve(self, request, pk=None):
        """
        Approve a purchase order (Finance/Admin only).
        Finance can select or change supplier before approving.
        """
        tenant = getattr(self.request.user, "tenant", None)
        if tenant is None:
            return Response(
                {"detail": "Tenant context not found."},
                status=status.HTTP_403_FORBIDDEN,
            )

        require_feature(tenant, "purchases")
        purchase = self.get_object()

        if purchase.status != PurchaseOrder.STATUS_PENDING:
            return Response({"detail": "Only pending orders can be approved."}, status=status.HTTP_400_BAD_REQUEST)

        supplier_id = request.data.get("supplier")
        if not supplier_id:
            return Response({"detail": "Supplier must be provided when approving."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            supplier = Supplier.objects.get(id=supplier_id)
        except Supplier.DoesNotExist:
            return Response({"detail": "Invalid supplier ID."}, status=status.HTTP_400_BAD_REQUEST)

        purchase.supplier = supplier
        purchase.status = PurchaseOrder.STATUS_APPROVED_PENDING_PAYMENT
        purchase.approved_by = request.user
        purchase.approved_at = timezone.now()
        purchase.save()
        
        # Notify purchase creator
        notify_user(
            tenant=purchase.tenant,
            recipient=purchase.created_by,
            title="Purchase Approved",
            message=f"Your purchase order #{purchase.id} has been approved and is pending payment.",
            notification_type="purchase_approved",
        )

        serializer = self.get_serializer(purchase)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated, IsFinanceOfficer])
    def reject(self, request, pk=None):
        """Reject a purchase order (Finance/Admin only)."""
        tenant = getattr(self.request.user, "tenant", None)
        if tenant is None:
            return Response(
                {"detail": "Tenant context not found."},
                status=status.HTTP_403_FORBIDDEN,
            )

        require_feature(tenant, "purchases")
        purchase = self.get_object()
        if purchase.status not in [
            PurchaseOrder.STATUS_PENDING,
            PurchaseOrder.STATUS_APPROVED_PENDING_PAYMENT,
        ]:
            return Response(
                {"detail": "Only pending or approved orders can be rejected."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        purchase.status = PurchaseOrder.STATUS_CANCELLED
        purchase.save()
        
        # Notify purchase creator
        notify_user(
            tenant=purchase.tenant,
            recipient=purchase.created_by,
            title="Purchase Rejected",
            message=f"Your purchase order #{purchase.id} has been rejected.",
            notification_type="purchase_rejected",
        )

        serializer = self.get_serializer(purchase)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated, IsFinanceOfficer], serializer_class=PurchaseMarkPaidSerializer,)
    def mark_paid(self, request, pk=None):
        """
        Mark a purchase as paid (Finance/Admin only).
        REQUIREMENT: request must include 'items' array where each item object
        contains the purchase item 'id' and a valid 'new_price' value.
        Example:
        {
          "items": [
            {"id": 5, "new_price": "120.00"},
            {"id": 6, "new_price": "80.50"}
          ]
        }
        """
        tenant = getattr(self.request.user, "tenant", None)
        if tenant is None:
            return Response(
                {"detail": "Tenant context not found."},
                status=status.HTTP_403_FORBIDDEN,
            )

        require_feature(tenant, "purchases")
        purchase = self.get_object()

        if purchase.status != PurchaseOrder.STATUS_APPROVED_PENDING_PAYMENT:
            return Response(
                {"detail": "Only approved orders can be marked as paid."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate incoming items payload format
        incoming_items = request.data.get("items")
        if not isinstance(incoming_items, list) or len(incoming_items) == 0:
            return Response(
                {"detail": "You must provide an 'items' list with each item's id and new_price."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Build a map of provided new_price values and collect missing ids
        incoming_map = {}
        provided_ids = set()
        invalid_price_for = []
        for it in incoming_items:
            try:
                item_id = it.get("id")
                if item_id is None:
                    continue
                item_id = int(item_id)
            except (TypeError, ValueError):
                continue

            provided_ids.add(item_id)

            # new_price must be present and a valid decimal string
            if "new_price" not in it:
                invalid_price_for.append(item_id)
                continue

            raw = it.get("new_price")
            if raw in (None, "", "null"):
                invalid_price_for.append(item_id)
                continue

            try:
                incoming_map[item_id] = Decimal(str(raw))
            except Exception:
                invalid_price_for.append(item_id)

        # Ensure every purchase item of this purchase has a provided new_price
        purchase_item_ids = {i.id for i in purchase.items.all()}
        missing = purchase_item_ids - provided_ids
        if missing:
            return Response(
                {"detail": "Missing new_price for item ids: {}".format(sorted(missing))},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if invalid_price_for:
            return Response(
                {"detail": "Invalid or empty new_price for item ids: {}".format(sorted(invalid_price_for))},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # All validation passed — apply payment, prices and stock updates atomically
        with transaction.atomic():
            purchase.status = PurchaseOrder.STATUS_PAID
            purchase.paid_by = request.user
            purchase.paid_at = timezone.now()
            purchase.save(update_fields=["status", "paid_by", "paid_at"])

            for item in purchase.items.select_related("product").all():
                product = item.product

                # Overwrite PurchaseItem.new_price with finance-provided value (guaranteed present & valid)
                if item.id in incoming_map:
                    item.new_price = incoming_map[item.id]
                    item.save(update_fields=["new_price"])

                # Final price must be the PurchaseItem.new_price (now set) — fallback not needed because it's mandatory
                final_price = item.new_price

                # Apply final price and increase product quantity (stock)
                product.price = final_price
                product.quantity += item.quantity
                product.save(update_fields=["price", "quantity"])
                
        # Notify purchase creator
        notify_user(
            tenant=purchase.tenant,
            recipient=purchase.created_by,
            title="Purchase Paid",
            message=f"Your purchase order #{purchase.id} has been paid and inventory has been updated.",
            notification_type="purchase_paid",
        )

        serializer = self.get_serializer(purchase)
        return Response(serializer.data, status=status.HTTP_200_OK)


class PurchaseItemViewSet(TenantFilteredViewSet):
    """
    Handles purchase order items.
    Tenant filtering applies automatically via related purchase.
    """
    queryset = PurchaseItem.objects.none()
    serializer_class = PurchaseItemSerializer
    permission_classes = [IsAuthenticated, IsTenantAdminManagerOrFinance]

    def get_queryset(self):
        """Limit items to purchases under the user's tenant."""
        user = self.request.user
        base_qs = PurchaseItem.objects.select_related("purchase", "product")
        if user.is_superuser:
            return base_qs
        return base_qs.filter(purchase__tenant=user.tenant)
    
    def list(self, request, *args, **kwargs):
        """List purchase items — blocked for tenants without 'purchases' feature."""
        tenant = getattr(request.user, "tenant", None)
        if tenant is None:
            return Response(
                {"detail": "Tenant context not found."},
                status=status.HTTP_403_FORBIDDEN,
            )

        require_feature(tenant, "purchases")
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        """Retrieve single purchase item — blocked for tenants without 'purchases' feature."""
        tenant = getattr(request.user, "tenant", None)
        if tenant is None:
            return Response(
                {"detail": "Tenant context not found."},
                status=status.HTTP_403_FORBIDDEN,
            )

        require_feature(tenant, "purchases")
        return super().retrieve(request, *args, **kwargs)








