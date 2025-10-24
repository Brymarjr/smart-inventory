from django.db import models
from decimal import Decimal
from django.utils import timezone
from core.models import TenantAwareModel  # your tenant-aware base
from django.conf import settings


class PurchaseOrder(TenantAwareModel):
    STATUS_PENDING = "pending"
    STATUS_APPROVED_PENDING_PAYMENT = "approved_pending_payment"
    STATUS_PAID = "paid"
    STATUS_CANCELLED = "cancelled"

    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_APPROVED_PENDING_PAYMENT, "Approved (Pending Payment)"),
        (STATUS_PAID, "Paid"),
        (STATUS_CANCELLED, "Cancelled"),
    ]

    supplier = models.ForeignKey(
        "inventory.Supplier",
        on_delete=models.PROTECT,
        related_name="purchase_orders",
        null=True,
        blank=True,
        help_text="Supplier can be assigned during approval."
    )

    reference = models.CharField(max_length=120, blank=True, null=True, unique=True)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default=STATUS_PENDING)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="created_purchases"
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="approved_purchases"
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    paid_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="paid_purchases"
    )
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ["-created_at"]
        permissions = [
            ("approve_purchaseorder", "Can approve purchase orders"),
            ("mark_paid_purchaseorder", "Can mark purchase orders as paid"),
        ]

    def save(self, *args, **kwargs):
        """Auto-generate tenant-specific reference if not set."""
        if not self.reference:
            year = timezone.now().year
            tenant_code = (
                self.tenant.name[:4].upper() if self.tenant and self.tenant.name else "GEN"
            )
            count = (
                PurchaseOrder.objects.filter(
                    tenant=self.tenant, created_at__year=year
                ).count() + 1
            )
            self.reference = f"PO-{tenant_code}-{year}-{count:04d}"

        super().save(*args, **kwargs)

    def __str__(self):
        supplier_name = self.supplier.name if self.supplier else "No Supplier"
        return f"{self.reference} - {supplier_name} ({self.status})"


class PurchaseItem(models.Model):
    purchase = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey("inventory.Product", on_delete=models.PROTECT, related_name="purchase_items")
    quantity = models.PositiveIntegerField()
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, editable=False)
    new_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    class Meta:
        ordering = ["id"]

    def save(self, *args, **kwargs):
        # calculate subtotal
        self.subtotal = (self.unit_cost or 0) * (self.quantity or 0)

        #  only set new_price if this is a new item and new_price not explicitly provided
        if self._state.adding and self.new_price is None:
            self.new_price = self.unit_cost

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.product.name} x {self.quantity}"


