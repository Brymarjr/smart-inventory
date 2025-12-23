from django.contrib import admin
from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "tenant",
        "recipient",
        "notification_type",
        "title",
        "is_read",
        "created_at",
    )
    list_filter = ("notification_type", "is_read", "created_at")
    search_fields = ("title", "message", "recipient__email")

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        # Filter notifications to only show those for the user's tenant
        return qs.filter(tenant=request.user.tenant)
    
        actions = ["mark_as_read"]

    def mark_as_read(self, request, queryset):
        updated = queryset.update(is_read=True)
        self.message_user(request, f"{updated} notification(s) marked as read.")
    mark_as_read.short_description = "Mark selected notifications as read"

    def save_model(self, request, obj, form, change):
        if not obj.tenant_id:
            obj.tenant = request.user.tenant
        super().save_model(request, obj, form, change)

