from rest_framework import serializers
from .models import (
    Device,
    SyncJob,
    SyncOperation,
    SyncConflict,
    SyncCursor,
    ChangeLog,
)


class DeviceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Device
        fields = [
            "id",
            "tenant",
            "user",
            "device_id",
            "name",
            "last_seen",
            "metadata",
        ]
        read_only_fields = ["id", "last_seen"]


class SyncJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = SyncJob
        fields = [
            "id",
            "tenant",
            "submitted_by",
            "device",
            "created_at",
            "started_at",
            "completed_at",
            "status",
            "result",
        ]
        read_only_fields = ["id", "created_at", "started_at", "completed_at"]


class SyncOperationSerializer(serializers.ModelSerializer):
    class Meta:
        model = SyncOperation
        fields = [
            "id",
            "sync_job",
            "client_change_id",
            "model_name",
            "action",
            "payload",
            "processed",
            "processed_at",
            "success",
            "error",
        ]
        read_only_fields = ["id", "processed", "processed_at", "success", "error"]


class SyncConflictSerializer(serializers.ModelSerializer):
    class Meta:
        model = SyncConflict
        fields = [
            "id",
            "sync_operation",
            "server_snapshot",
            "client_payload",
            "resolved",
            "resolution",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class ChangeLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChangeLog
        fields = [
            "id",
            "tenant",
            "model",
            "model_id",
            "action",
            "payload",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class SyncCursorSerializer(serializers.ModelSerializer):
    class Meta:
        model = SyncCursor
        fields = [
            "id",
            "tenant",
            "device",
            "last_server_version",
            "updated_at",
        ]
        read_only_fields = ["id", "updated_at"]


class ClientOperationSerializer(serializers.Serializer):
    client_change_id = serializers.CharField(max_length=100)
    model_name = serializers.CharField(max_length=100)
    action = serializers.ChoiceField(choices=["create", "update", "delete"])
    payload = serializers.JSONField()


class SyncUploadSerializer(serializers.Serializer):
    """
    Input schema for /api/sync/upload/.
    """
    device_id = serializers.CharField(max_length=100)
    client_ops = ClientOperationSerializer(many=True)
