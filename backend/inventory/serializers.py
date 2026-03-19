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
    supplier = SupplierSerializer(read_only=True)
    # ✅ STRATEGIC INJECTION: Nested Price History
    supplier_prices = SupplierPriceSerializer(many=True, read_only=True)

    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category._base_manager.none(),
        source='category',
        write_only=True
    )
    supplier_id = serializers.PrimaryKeyRelatedField(
        queryset=Supplier._base_manager.none(),
        source='supplier',
        write_only=True
    )

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'sku', 'category', 'supplier',
            'quantity', 'price', 'cost_price', 'description',
            'category_id', 'supplier_id', 'supplier_prices' # ✅ Included here
        ]
        read_only_fields = ['tenant']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        try:
            self.fields['category_id'].queryset = Category.objects.all()
            self.fields['supplier_id'].queryset = Supplier.objects.all()
        except TenantNotSetError:
            self.fields['category_id'].queryset = Category._base_manager.none()
            self.fields['supplier_id'].queryset = Supplier._base_manager.none()

    def create(self, validated_data):
        tenant = self.context['request'].user.tenant
        validated_data['tenant'] = tenant
        return super().create(validated_data)