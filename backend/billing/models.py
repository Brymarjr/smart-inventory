from django.db import models
from tenants.models import Tenant
from django.utils import timezone

class Plan(models.Model):
    """
    Pricing plans. Amount is stored in kobo (NGN) or smallest currency unit.
    """
    name = models.CharField(max_length=100, unique=True)
    amount = models.PositiveIntegerField(help_text="Amount in kobo / smallest currency unit (e.g. NGN*100)")
    currency = models.CharField(max_length=10, default="NGN")
    duration_days = models.PositiveIntegerField(default=30, help_text="Subscription duration in days")
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    @property
    def amount_kobo(self):
        """Return the plan amount in kobo for Paystack."""
        return int(self.amount * 100)

    def __str__(self):
        return f"{self.name} ({self.amount} {self.currency}/{self.duration_days})"


class Subscription(models.Model):
    STATUS_CHOICES = [
        ("active", "Active"),
        ("inactive", "Inactive"),
        ("pending", "Pending"),
        ("cancelled", "Cancelled"),
        ("expired", "Expired"),
    ]

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="subscriptions")
    plan = models.ForeignKey(Plan, on_delete=models.SET_NULL, null=True, blank=True, related_name="subscriptions")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    started_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    paystack_reference = models.CharField(max_length=255, blank=True, null=True)
    paystack_authorization = models.JSONField(blank=True, null=True)
    auto_renew = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    metadata = models.JSONField(blank=True, null=True)

    class Meta:
        # allow multiple subscriptions but only one active per tenant (logic-enforced)
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.tenant} -> {self.plan.name if self.plan else 'No Plan'} ({self.status})"

    @property
    def is_expired(self):
        return self.expires_at and timezone.now() > self.expires_at


class Transaction(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="transactions")
    subscription = models.ForeignKey(Subscription, on_delete=models.SET_NULL, null=True, blank=True, related_name="transactions")
    reference = models.CharField(max_length=255, unique=True)
    amount = models.PositiveIntegerField()
    currency = models.CharField(max_length=10, default="NGN")
    status = models.CharField(max_length=50, default="pending")
    verified_at = models.DateTimeField(null=True, blank=True)  # added for PaystackVerifyView
    raw_response = models.JSONField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.reference} ({self.tenant}) - {self.status}"


