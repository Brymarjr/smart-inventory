from django.contrib import admin
from . import models as sync_models
from django.utils.html import format_html
import json


@admin.register(sync_models.Device)
class DeviceAdmin(admin.ModelAdmin):
    list_display = ("id", "device_id", "user", "tenant", "last_seen")
    search_fields = ("device_id", "user__email", "user__username")
    list_filter = ("tenant",)
    readonly_fields = ("last_seen",)


@admin.register(sync_models.SyncJob)
class SyncJobAdmin(admin.ModelAdmin):
    list_display = ("id", "tenant", "submitted_by", "status", "created_at", "completed_at")
    list_filter = ("status", "tenant")
    readonly_fields = ("created_at", "started_at", "completed_at", "result")
    search_fields = ("submitted_by__email",)


@admin.register(sync_models.SyncOperation)
class SyncOperationAdmin(admin.ModelAdmin):
    list_display = ("id", "sync_job", "client_change_id", "model_name", "action", "processed", "success")
    list_filter = ("processed", "success", "action")
    readonly_fields = ("processed_at", "error")
    search_fields = ("client_change_id", "model_name")


@admin.register(sync_models.SyncConflict)
class SyncConflictAdmin(admin.ModelAdmin):
    list_display = ("id", "sync_operation", "resolved", "created_at")
    list_filter = ("resolved",)
    readonly_fields = ("server_snapshot", "client_payload", "resolution")
    search_fields = ("sync_operation__client_change_id",)

    def server_snapshot_pretty(self, obj):
        try:
            return format_html("<pre>{}</pre>", json.dumps(obj.server_snapshot, indent=2))
        except Exception:
            return obj.server_snapshot

    server_snapshot_pretty.short_description = "Server Snapshot"


@admin.register(sync_models.ChangeLog)
class ChangeLogAdmin(admin.ModelAdmin):
    list_display = ("id", "tenant", "model", "model_id", "action", "created_at")
    readonly_fields = ("payload", "created_at")
    list_filter = ("tenant", "model", "action")
    search_fields = ("model",)


@admin.register(sync_models.SyncCursor)
class SyncCursorAdmin(admin.ModelAdmin):
    list_display = ("id", "tenant", "device", "last_server_version", "updated_at")
    readonly_fields = ("updated_at",)
    search_fields = ("device__device_id",)

