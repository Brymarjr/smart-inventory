from django.db import models
from django.conf import settings
from inventory.models import Product
from tenants.models import Tenant

class ForecastModel(models.Model):
    """
    Stores trained model metadata (Regression parameters, etc.)
    """
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    model_type = models.CharField(max_length=50) # e.g., 'trend_seasonality'
    file_path = models.CharField(max_length=255) 
    trained_at = models.DateTimeField(auto_now_add=True)
    version = models.IntegerField(default=1)
    
    # Store global metrics for the tenant's data quality
    data_quality_score = models.FloatField(default=0.0) 

    class Meta:
        unique_together = ('tenant', 'version', 'model_type')


class Forecast(models.Model):
    """
    Stores future predictions.
    """
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    prediction_date = models.DateField()
    predicted_quantity = models.FloatField() # Float for precision
    
    # We store the "Why" - e.g., "High volatility detected"
    reasoning = models.CharField(max_length=255, blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('tenant', 'product', 'prediction_date')
        ordering = ['prediction_date']


class InventoryAnomaly(models.Model):
    """
    Fraud & Anomaly Detection
    Stores instances where stock changed suspiciously or sales spiked/dropped abnormally.
    """
    SEVERITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High - Possible Fraud'),
    ]
    
    ANOMALY_TYPES = [
        ('shrinkage', 'Unexplained Stock Drop'),
        ('velocity_spike', 'Sudden Sales Spike'),
        ('stockout_risk', 'Imminent Stockout'),
    ]

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    anomaly_type = models.CharField(max_length=50, choices=ANOMALY_TYPES)
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES)
    
    description = models.TextField()
    detected_at = models.DateTimeField(auto_now_add=True)
    is_resolved = models.BooleanField(default=False)

    class Meta:
        ordering = ['-detected_at']