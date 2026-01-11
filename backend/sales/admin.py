from django.contrib import admin
from .models import Sale, SaleItem

class SaleItemInline(admin.TabularInline):
    model = SaleItem
    readonly_fields = ('product', 'quantity', 'unit_price', 'subtotal')
    can_delete = False
    extra = 0

@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = ('reference', 'tenant', 'total_amount', 'payment_method', 'created_by', 'created_at')
    inlines = [SaleItemInline]
    readonly_fields = ('reference', 'total_amount', 'created_at')
    # Make sale immutable in admin (no change form) by overriding has_change_permission
    def has_change_permission(self, request, obj=None):
        return False  # locked down: no edits once created

