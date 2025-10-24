from django.db import models
from core.models import TenantAwareModel   #  Import tenant base
from core.managers import TenantManager

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
    quantity = models.PositiveIntegerField(default=0)
    reorder_level = models.PositiveIntegerField(default=10)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    objects = TenantManager()

    class Meta:
        unique_together = ("tenant", "sku")

    def __str__(self):
        return self.name


