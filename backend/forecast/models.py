from django.db import models
from django.conf import settings
from inventory.models import Product
from tenants.models import Tenant


class ForecastModel(models.Model):
    """
    Stores trained ML model metadata per tenant.
    """
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    model_type = models.CharField(max_length=50)  # e.g., baseline, ARIMA, XGBoost
    file_path = models.CharField(max_length=255)  # path to the saved model
    trained_at = models.DateTimeField(auto_now_add=True)
    version = models.IntegerField(default=1)
    accuracy_score = models.FloatField(null=True, blank=True)

    class Meta:
        unique_together = ('tenant', 'version', 'model_type')

    def __str__(self):
        return f"{self.tenant} - {self.model_type} v{self.version}"


class ForecastFeature(models.Model):
    """
    Optional: store engineered features for debugging and retraining.
    """
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    feature_data = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)


class Forecast(models.Model):
    """
    Stores predicted quantities per product per tenant.
    """
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    predicted_quantity = models.IntegerField()
    confidence_interval = models.JSONField(null=True, blank=True)  # e.g., {"min": 5, "max": 15}
    prediction_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('tenant', 'product', 'prediction_date')

    def __str__(self):
        return f"{self.tenant} - {self.product} - {self.prediction_date}"

