from rest_framework import serializers
from .models import PurchaseOrder, PurchaseItem
from inventory.models import Supplier, Product
from django.utils import timezone

class PurchaseItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)

    # Make new_price read-only so it cannot be supplied at creation/approval time
    new_price = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = PurchaseItem
        fields = ["id", "product", "product_name", "quantity", "unit_cost", "subtotal", "new_price"]
        read_only_fields = ["subtotal", "new_price"]

class PurchaseOrderSerializer(serializers.ModelSerializer):
    # items writable for creation, but new_price inside each item will be ignored at create time
    items = PurchaseItemSerializer(many=True, required=True)

    supplier_name = serializers.CharField(source="supplier.name", read_only=True)

    supplier = serializers.PrimaryKeyRelatedField(
        queryset=Supplier.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = PurchaseOrder
        fields = [
            "id",
            "reference",
            "supplier",
            "supplier_name",
            "total_amount",
            "status",
            "created_by",
            "approved_by",
            "approved_at",
            "paid_by",
            "paid_at",
            "created_at",
            "notes",
            "items",
        ]
        read_only_fields = [
            "reference",
            "status",
            "approved_by",
            "approved_at",
            "paid_by",
            "paid_at",
            "created_at",
            "created_by",
            "total_amount",
        ]

    def create(self, validated_data):
        # Pop items and ensure any supplied 'new_price' by staff is ignored
        items_data = validated_data.pop("items", [])
        purchase = PurchaseOrder.objects.create(**validated_data)

        total = 0
        for item_data in items_data:
            # Remove new_price if present (staff should not set it at creation)
            item_data.pop("new_price", None)
            item = PurchaseItem.objects.create(purchase=purchase, **item_data)
            total += item.subtotal

        purchase.total_amount = total
        purchase.save()
        return purchase

    # Keep update() untouched — mark_paid handles final pricing explicitly in the view.
    def update(self, instance, validated_data):
        """
        Default update kept for other use-cases. We rely on the view's mark_paid
        action to enforce finance-only new_price behavior.
        """
        request = self.context.get("request")
        items_data = validated_data.pop("items", [])
        status_before = instance.status

        # Normal update
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        # Keep existing behavior but do not expect new_price here for marking paid.
        if instance.status == "paid" and status_before != "paid":
            instance.paid_at = timezone.now()
            instance.paid_by = request.user

            for item_data in items_data:
                item_id = item_data.get("id")
                if not item_id:
                    continue
                try:
                    purchase_item = PurchaseItem.objects.get(id=item_id, purchase=instance)
                except PurchaseItem.DoesNotExist:
                    continue

                # Note: we do not accept new_price here from serializer-level updates.
                # Price and stock updates are handled exclusively in mark_paid view.
                # However keep stock update just in case:
                product = purchase_item.product
                product.quantity += purchase_item.quantity
                product.save()

        instance.save()
        return instance


class PurchaseMarkPaidItemSerializer(serializers.Serializer):
    id = serializers.IntegerField(help_text="ID of the PurchaseItem (required)")
    new_price = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="New price for the product (required)",
    )

class PurchaseMarkPaidSerializer(serializers.Serializer):
    items = PurchaseMarkPaidItemSerializer(
        many=True,
        help_text="List of purchase items with their new prices"
    )


