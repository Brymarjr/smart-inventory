import logging
from django.conf import settings
from django.db import models
from django.utils import timezone
from inventory.models import Product 

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
    reference = models.CharField(max_length=32, unique=True, db_index=True)
    customer_name = models.CharField(max_length=255, blank=True, null=True)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.CharField(max_length=16, choices=PAYMENT_METHOD_CHOICES)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='sales_created')
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
    
    # Snapshot of Cost Price
    cost_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)

    def save(self, *args, **kwargs):
        self.subtotal = (self.unit_price or 0) * (self.quantity or 0)
        
        # AUTOMATION: Grab cost from Product if we didn't provide one
        if self.cost_price is None or self.cost_price == 0:
            if self.product:
                # Uses the field we just added to Product
                self.cost_price = self.product.cost_price 

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.product} x {self.quantity}"