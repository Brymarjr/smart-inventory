from rest_framework import serializers
from .models import Category, Supplier, Product, SupplierPrice
from core.tenant_context import TenantNotSetError

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'
        read_only_fields = ['tenant']

    def create(self, validated_data):
        tenant = self.context['request'].user.tenant
        validated_data['tenant'] = tenant
        return super().create(validated_data)

class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = '__all__'
        read_only_fields = ['tenant']

    def create(self, validated_data):
        tenant = self.context['request'].user.tenant
        validated_data['tenant'] = tenant
        return super().create(validated_data)

# Serializer for the Price Matrix
class SupplierPriceSerializer(serializers.ModelSerializer):
    supplier_name = serializers.ReadOnlyField(source='supplier.name')

    class Meta:
        model = SupplierPrice
        fields = ['id', 'supplier_name', 'supply_price', 'last_updated']

class ProductSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    # ✅ Removed supplier nested serializer as it's not needed for creation
    supplier_prices = SupplierPriceSerializer(many=True, read_only=True)

    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(),
        source='category',
        write_only=True,
        required=True,
        error_messages={'required': 'Please select a product category.'}
    )

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'sku', 'category', 'category_id',
            'quantity', 'price', 'cost_price', 'description',
            'reorder_level', 'supplier_prices'
        ]
        read_only_fields = ['tenant']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Ensure the queryset is restricted to the current tenant
        try:
            request = self.context.get('request')
            if request and hasattr(request, 'user'):
                self.fields['category_id'].queryset = Category.objects.filter(tenant=request.user.tenant)
        except Exception:
            self.fields['category_id'].queryset = Category.objects.none()

    def create(self, validated_data):
        tenant = self.context['request'].user.tenant
        validated_data['tenant'] = tenant
        return super().create(validated_data)