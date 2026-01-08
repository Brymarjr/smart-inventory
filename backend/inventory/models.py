from django.db import models
from core.models import TenantAwareModel   #  Import tenant base
from core.managers import TenantManager
from django.conf import settings # To get the User model
from tenants.models import Tenant

class Category(TenantAwareModel):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    objects = TenantManager()

    class Meta:
        verbose_name = "Category"
        verbose_name_plural = "Categories"
        unique_together = ("tenant", "name")  #  ensure uniqueness per tenant

    def __str__(self):
        return self.name


class Supplier(TenantAwareModel):
    name = models.CharField(max_length=150)
    email = models.EmailField(blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    objects = TenantManager()

    class Meta:
        unique_together = ("tenant", "name")

    def __str__(self):
        return self.name


class Product(TenantAwareModel):
    name = models.CharField(max_length=150)
    sku = models.CharField(max_length=100)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True)
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True)
    description = models.TextField(blank=True, null=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    
    # Field for Profit Calculation
    cost_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    
    quantity = models.PositiveIntegerField(default=0)
    reorder_level = models.PositiveIntegerField(default=10)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    objects = TenantManager()
    is_deleted = models.BooleanField(default=False)

    class Meta:
        unique_together = ("tenant", "sku")

    def __str__(self):
        return self.name


class InventoryLog(models.Model):
    REASON_CHOICES = [
        ('restock', 'Restock / Purchase'),
        ('damage', 'Damaged / Expired'),
        ('theft', 'Theft / Shrinkage'),
        ('correction', 'Inventory Count Correction'),
        ('return', 'Customer Return'),
    ]

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='logs')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    
    change_amount = models.IntegerField(help_text="Positive for addition, Negative for deduction")
    reason = models.CharField(max_length=20, choices=REASON_CHOICES)
    note = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.product.name}: {self.change_amount} ({self.reason})"