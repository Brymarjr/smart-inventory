from decimal import Decimal
from django.db import transaction
from django.db.models import F
from rest_framework import serializers
from inventory.models import Product
from .models import Sale, SaleItem
from . import tasks
from django.conf import settings
from django.utils import timezone

def generate_sale_reference():
    # Format: SAL-YYYYMMDD-XXXX (XXXX is zero-padded counter per day)
    today = timezone.now().date().strftime('%Y%m%d')
    prefix = f"SAL-{today}"
    # It's acceptable to use a simple counter by counting existing refs for the day.
    # For very high concurrency, consider a dedicated counter table or DB sequence.
    existing_count = Sale.objects.filter(reference__startswith=prefix).count()
    return f"{prefix}-{existing_count + 1:04d}"

class SaleItemInputSerializer(serializers.Serializer):
    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all())
    quantity = serializers.IntegerField(min_value=1)

class SaleItemSerializer(serializers.ModelSerializer):
    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all())

    class Meta:
        model = SaleItem
        fields = ('id', 'product', 'quantity', 'unit_price', 'subtotal')

class SaleCreateSerializer(serializers.Serializer):
    tenant = serializers.PrimaryKeyRelatedField(read_only=True)
    customer_name = serializers.CharField(required=False, allow_blank=True)
    payment_method = serializers.ChoiceField(choices=Sale.PAYMENT_METHOD_CHOICES)
    notes = serializers.CharField(required=False, allow_blank=True)
    items = SaleItemInputSerializer(many=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # set queryset lazily to avoid circular imports if tenants app loads later
        from tenants.models import Tenant
        self.fields['tenant'].queryset = Tenant.objects.all()

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("A sale must include at least one item.")
        return value

    def create(self, validated_data):
        request = self.context.get('request')
        user = request.user
        tenant = request.user.tenant  # ✅ tenant from logged-in user
        items_data = validated_data.pop('items')

        from inventory.models import Product

        with transaction.atomic():
            product_ids = [it['product'].id for it in items_data]
            products_qs = Product.objects.select_for_update().filter(pk__in=product_ids)

            products_map = {p.pk: p for p in products_qs}

            total = Decimal('0.00')
            for it in items_data:
                prod = products_map.get(it['product'].id)
                if prod is None:
                    raise serializers.ValidationError({'items': f"Product {it['product'].id} not found."})

                qty = int(it['quantity'])
                if getattr(prod, 'quantity', None) is None:
                    raise serializers.ValidationError({'items': f"Product {prod.pk} missing 'quantity' field."})

                if prod.quantity < qty:
                    raise serializers.ValidationError({'items': f"Insufficient stock for product {prod.pk}."})

                unit_price = prod.get_effective_price() if hasattr(prod, 'get_effective_price') else prod.price
                total += (unit_price * qty)

            reference = generate_sale_reference()
            sale = Sale.objects.create(
                tenant=tenant,
                reference=reference,
                customer_name=validated_data.get('customer_name', '') or None,
                total_amount=total,
                payment_method=validated_data['payment_method'],
                created_by=user,
                notes=validated_data.get('notes', '') or None
            )

            low_stock_alerts = []
            for it in items_data:
                prod = products_map[it['product'].id]
                qty = int(it['quantity'])
                unit_price = prod.get_effective_price() if hasattr(prod, 'get_effective_price') else prod.price
                subtotal = unit_price * qty

                SaleItem.objects.create(
                    sale=sale,
                    product=prod,
                    quantity=qty,
                    unit_price=unit_price,
                    subtotal=subtotal
                )

                # ✅ decrement quantity instead of stock
                Product.objects.filter(pk=prod.pk).update(quantity=F('quantity') - qty)

                # refresh product to check if low stock
                prod.refresh_from_db(fields=['quantity'])
                threshold = getattr(prod, 'reorder_level', getattr(settings, 'DEFAULT_LOW_STOCK_THRESHOLD', 10))
                if prod.quantity <= threshold:
                    low_stock_alerts.append(prod.pk)

            for pid in low_stock_alerts:
                tasks.notify_low_stock.delay(pid)

            return sale


class SaleReadSerializer(serializers.ModelSerializer):
    items = SaleItemSerializer(many=True, read_only=True)
    created_by = serializers.StringRelatedField()

    class Meta:
        model = Sale
        fields = ('id', 'tenant', 'reference', 'customer_name', 'total_amount',
                  'payment_method', 'created_by', 'created_at', 'notes', 'items')
