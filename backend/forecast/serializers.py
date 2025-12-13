from rest_framework import serializers

from forecast.models import Forecast, ForecastModel
from inventory.models import Product
from sales.models import SaleItem, Sale

class ForecastModelSerializer(serializers.ModelSerializer):
    class Meta:
        model = ForecastModel
        fields = [
            'id',
            'model_type',
            'version',
            'accuracy_score',
        ]
        read_only_fields = fields


class ForecastSerializer(serializers.ModelSerializer):
    product_id = serializers.PrimaryKeyRelatedField(
        source='product',
        queryset=Product.objects.all()
    )
    product_name = serializers.CharField(
        source='product.name',
        read_only=True
    )

    class Meta:
        model = Forecast
        fields = [
            'id',
            'product_id',
            'product_name',
            'prediction_date',
            'predicted_quantity',
            'confidence_interval',
            'created_at',
        ]
        read_only_fields = fields
        

class ForecastDashboardSerializer(serializers.ModelSerializer):
    product_id = serializers.PrimaryKeyRelatedField(
        source='product',
        queryset=Product.objects.all()
    )
    product_name = serializers.CharField(source='product.name', read_only=True)
    last_sale_date = serializers.SerializerMethodField()
    recommended_action = serializers.SerializerMethodField()

    class Meta:
        model = Forecast
        fields = [
            'product_id',
            'product_name',
            'prediction_date',
            'predicted_quantity',
            'confidence_interval',
            'last_sale_date',
            'recommended_action',
        ]
        read_only_fields = fields

    def get_last_sale_date(self, obj):
        last_sale = (
            SaleItem.objects.filter(product=obj.product, sale__tenant=obj.tenant)
            .order_by('-sale__created_at')
            .first()
        )
        return last_sale.sale.created_at.date() if last_sale else None

    def get_recommended_action(self, obj):
        qty = obj.predicted_quantity
        if qty == 0:
            return "Do not reorder yet"
        elif qty <= 3:
            return "Consider ordering small batch"
        else:
            return "Monitor stock, reorder if below threshold"

