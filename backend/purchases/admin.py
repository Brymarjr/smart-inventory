from django.contrib import admin
from .models import PurchaseOrder, PurchaseItem
from core.admin import TenantSafeAdmin

class PurchaseItemInline(admin.TabularInline):
    model = PurchaseItem
    readonly_fields = ("subtotal",)
    extra = 0

@admin.register(PurchaseOrder)
class PurchaseOrderAdmin(TenantSafeAdmin):
    list_display = ("id", "reference", "supplier", "total_amount", "status", "created_by", "approved_by", "paid_by", "created_at", "approved_at", "paid_at")
    search_fields = ("reference", "supplier__name")
    inlines = [PurchaseItemInline]
    readonly_fields = ("total_amount", "reference", "created_by", "approved_by", "paid_by", "created_at", "approved_at", "paid_at")
