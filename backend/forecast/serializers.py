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
        pred = obj.predicted_quantity
        stock = obj.product.quantity
        
        # 1. THE ZERO STOCK FIX: If stock is 0, it is ALWAYS urgent.
        if stock <= 0:
            return "Urgent: Out of Stock"
            
        # 2. IMMEDIATE STOCKOUT: We don't have enough for tomorrow.
        if stock < pred:
            return f"Reorder {int(pred - stock)} units"
            
        # 3. SAFETY STOCK RISK: Less than 3 days of cover left based on tomorrow's demand.
        if pred > 0 and stock <= (pred * 3):
            return "Low Safety Stock"
            
        return "Healthy"