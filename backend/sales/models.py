import logging
from django.conf import settings
from django.db import models
from django.utils import timezone

logger = logging.getLogger(__name__)

class Sale(models.Model):
    PAYMENT_METHOD_CHOICES = [
        ('cash', 'Cash'),
        ('card', 'Card'),
        ('transfer', 'Bank Transfer'),
        ('pos', 'POS'),
        ('other', 'Other'),
    ]

    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.PROTECT)
    
    # Unique ID to prevent duplicate syncs from "Eager Push"
    tmp_id = models.CharField(max_length=100, unique=True, null=True, blank=True, db_index=True)
    
    reference = models.CharField(max_length=32, unique=True, db_index=True)
    customer_name = models.CharField(max_length=255, blank=True, null=True)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.CharField(max_length=16, choices=PAYMENT_METHOD_CHOICES)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='sales_created', null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    notes = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.reference} — {self.total_amount}"

class SaleItem(models.Model):
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey('inventory.Product', on_delete=models.PROTECT)
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    cost_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)

    def save(self, *args, **kwargs):
        self.subtotal = (self.unit_price or 0) * (self.quantity or 0)
        if (self.cost_price is None or self.cost_price == 0) and self.product:
            self.cost_price = getattr(self.product, 'cost_price', 0)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.product} x {self.quantity}"