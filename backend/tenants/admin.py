from django.contrib import admin
from .models import Tenant, AuditLog

@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "is_active", "created_at")
    search_fields = ("name", "slug")
    list_filter = ("is_active",)

@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("tenant", "action", "timestamp")
    search_fields = ("tenant__name", "user__username", "action")
    list_filter = ("timestamp",)

