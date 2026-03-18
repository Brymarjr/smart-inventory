from rest_framework import serializers
from .models import Forecast, InventoryAnomaly

class InventoryAnomalySerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_sku = serializers.CharField(source='product.sku', read_only=True)  # <--- Added
    
    class Meta:
        model = InventoryAnomaly
        fields = ['id', 'product_name', 'product_sku', 'anomaly_type', 'severity', 'description', 'detected_at']

class ForecastDashboardSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_sku = serializers.CharField(source='product.sku', read_only=True) # <--- Added
    current_stock = serializers.IntegerField(source='product.quantity', read_only=True)
    recommended_action = serializers.SerializerMethodField()
    
    class Meta:
        model = Forecast
        fields = [
            'product', 'product_name', 'product_sku', 'current_stock', 'prediction_date', 
            'predicted_quantity', 'reasoning', 'recommended_action'
        ]

    def get_recommended_action(self, obj):
        # Logic matches your previous file, which is perfect.
        pred = obj.predicted_quantity
        stock = obj.product.quantity
        
        if stock == 0 and pred > 0:
            return "Urgent: Out of Stock"
        if stock < pred:
            return f"Reorder {int(pred - stock)} units"
        if stock < (pred * 1.5):
            return "Low Safety Stock"
        return "Healthy"