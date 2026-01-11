from django.db import models
from django.utils.text import slugify
from django.conf import settings

class Tenant(models.Model):
    """
    Tenant represents a single store (single-branch) in the multi-tenant system.
    Keep this lightweight; additional billing fields will be added in the billing app.
    """
    name = models.CharField(max_length=200, unique=True)
    slug = models.SlugField(max_length=100, unique=True)
    owner = models.ForeignKey( 
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="owned_tenants",
        null=True, blank=True
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def clean(self):
        if not self.slug:
            self.slug = slugify(self.name)

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class TenantSettings(models.Model):
    tenant = models.OneToOneField(
        Tenant, 
        on_delete=models.CASCADE, 
        related_name='settings'
    )
    
    # --- Store Configuration ---
    store_name = models.CharField(max_length=255, blank=True, null=True)
    store_address = models.TextField(blank=True, null=True)
    currency_symbol = models.CharField(max_length=5, default='₦')
    
    # --- Notification Preferences ---
    low_stock_alerts = models.BooleanField(default=True)
    weekly_reports = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Settings for {self.tenant.name}"
    
    
class AuditLog(models.Model):
    ACTION_CHOICES = [
        ('UPDATE', 'Update'),
        ('DELETE', 'Delete'),
    ]

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True) 
    action = models.CharField(max_length=10, choices=ACTION_CHOICES)
    
    # What was changed? (e.g., "Category", "Supplier")
    target_model = models.CharField(max_length=50) 
    
    # What was it called? (e.g., "Beverages")
    target_name = models.CharField(max_length=255) 
    
    # The required reason for the change
    reason = models.TextField() 
    
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.actor} {self.action} {self.target_name}"