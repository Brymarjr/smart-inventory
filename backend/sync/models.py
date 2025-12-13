"""
Sync app models for the Smart Inventory project.

Models:
- Device: registered client device (per-tenant).
- SyncJob: an upload/upload job created by a client (contains many SyncOperation).
- SyncOperation: one client operation (create/update/delete) inside a job.
- SyncConflict: record of a detected conflict during operation application.
- SyncCursor: per-device / per-tenant cursor storing last known server_version.
- ChangeLog: monotonic change log used as server_version ordering.
"""

from django.db import models, transaction
from django.conf import settings
from django.utils import timezone


class Device(models.Model):
    """
    Represents a client device. Device.device_id is provided by client and
    must be unique per tenant.
    """
    tenant = models.ForeignKey("tenants.Tenant", on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    device_id = models.CharField(max_length=128)
    name = models.CharField(max_length=150, blank=True)
    last_seen = models.DateTimeField(default=timezone.now)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["tenant", "device_id"]),
            models.Index(fields=["tenant", "user"]),
        ]
        unique_together = (("tenant", "device_id"),)
        verbose_name = "Sync Device"
        verbose_name_plural = "Sync Devices"

    def __str__(self):
        return f"{self.device_id} ({self.user})"


class SyncJob(models.Model):
    """
    A sync upload job created by a client. Status is updated by the Celery worker.
    """
    STATUS_PENDING = "pending"
    STATUS_PROCESSING = "processing"
    STATUS_DONE = "done"
    STATUS_FAILED = "failed"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_PROCESSING, "Processing"),
        (STATUS_DONE, "Done"),
        (STATUS_FAILED, "Failed"),
    ]

    tenant = models.ForeignKey("tenants.Tenant", on_delete=models.CASCADE)
    submitted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    device = models.ForeignKey(Device, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default=STATUS_PENDING)
    result = models.JSONField(null=True, blank=True)  # summary JSON: counts, examples, errors

    class Meta:
        indexes = [models.Index(fields=["tenant", "status", "created_at"])]
        ordering = ["-created_at"]
        verbose_name = "Sync Job"
        verbose_name_plural = "Sync Jobs"

    def mark_started(self):
        self.status = self.STATUS_PROCESSING
        self.started_at = timezone.now()
        self.save(update_fields=["status", "started_at"])

    def mark_completed(self, result: dict):
        self.status = self.STATUS_DONE
        self.completed_at = timezone.now()
        self.result = result
        self.save(update_fields=["status", "completed_at", "result"])

    def mark_failed(self, result: dict):
        self.status = self.STATUS_FAILED
        self.completed_at = timezone.now()
        self.result = result
        self.save(update_fields=["status", "completed_at", "result"])

    def __str__(self):
        return f"Job {self.id} ({self.tenant}) - {self.status}"


class SyncOperation(models.Model):
    """
    Single client operation inside a SyncJob. client_change_id required for idempotency.
    action: create|update|delete
    payload: model-specific JSON (validated by serializer/handler).
    """
    ACTION_CREATE = "create"
    ACTION_UPDATE = "update"
    ACTION_DELETE = "delete"

    sync_job = models.ForeignKey(SyncJob, on_delete=models.CASCADE, related_name="operations")
    client_change_id = models.CharField(max_length=128)  # client-provided id for idempotency
    model_name = models.CharField(max_length=128)  # e.g., 'inventory.Product'
    action = models.CharField(max_length=10)
    payload = models.JSONField()
    processed = models.BooleanField(default=False)
    processed_at = models.DateTimeField(null=True, blank=True)
    success = models.BooleanField(null=True)
    error = models.TextField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["sync_job", "client_change_id"]),
            models.Index(fields=["sync_job", "processed"]),
        ]
        # Deduplicate operations per job by client_change_id
        unique_together = (("sync_job", "client_change_id"),)
        verbose_name = "Sync Operation"
        verbose_name_plural = "Sync Operations"

    def mark_processed(self, success: bool, error: str | None = None):
        self.processed = True
        self.processed_at = timezone.now()
        self.success = success
        self.error = error
        self.save(update_fields=["processed", "processed_at", "success", "error"])

    def __str__(self):
        return f"Op {self.id} [{self.action}] {self.model_name} (job={self.sync_job_id})"


class SyncConflict(models.Model):
    """
    Records conflicts detected when applying an operation.
    server_snapshot: server's JSON snapshot of the resource at time of conflict
    client_payload: the payload submitted by client that caused the conflict
    resolution: JSON describing chosen resolution (optional)
    """
    sync_operation = models.ForeignKey(SyncOperation, on_delete=models.CASCADE, related_name="conflicts")
    server_snapshot = models.JSONField()
    client_payload = models.JSONField()
    resolved = models.BooleanField(default=False)
    resolution = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["sync_operation", "resolved", "created_at"])]
        verbose_name = "Sync Conflict"
        verbose_name_plural = "Sync Conflicts"

    def mark_resolved(self, resolution: dict | None = None):
        self.resolved = True
        self.resolution = resolution
        self.save(update_fields=["resolved", "resolution"])

    def __str__(self):
        return f"Conflict for op {self.sync_operation_id} (resolved={self.resolved})"


class ChangeLog(models.Model):
    """
    Monotonic global change log. Each created row gets an auto incrementing id which
    is used as the authoritative server_version. Storing tenant here allows filtering.
    Note: version is the primary key (auto-incrementing).
    """
    # id (BIGAUTO) will serve as the server_version/monotonic cursor
    tenant = models.ForeignKey("tenants.Tenant", on_delete=models.CASCADE)
    model = models.CharField(max_length=128)  # e.g., 'inventory.Product'
    model_id = models.BigIntegerField(null=True, blank=True)
    action = models.CharField(max_length=16)  # create|update|delete
    payload = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["tenant", "id"]),  # id is the version
            models.Index(fields=["tenant", "created_at"]),
        ]
        ordering = ["id"]
        verbose_name = "Change Log"
        verbose_name_plural = "Change Logs"

    def __str__(self):
        return f"ChangeLog {self.id} ({self.model}#{self.model_id})"


class SyncCursor(models.Model):
    """
    Tracks last known server_version for a device (tenant + device pair).
    """
    tenant = models.ForeignKey("tenants.Tenant", on_delete=models.CASCADE)
    device = models.ForeignKey(Device, on_delete=models.CASCADE)
    last_server_version = models.BigIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = (("tenant", "device"),)
        indexes = [models.Index(fields=["tenant", "device", "last_server_version"])]
        verbose_name = "Sync Cursor"
        verbose_name_plural = "Sync Cursors"

    def update_version(self, version: int):
        # we update monotonically only if greater
        if version > (self.last_server_version or 0):
            self.last_server_version = version
            self.save(update_fields=["last_server_version", "updated_at"])

    def __str__(self):
        return f"Cursor {self.device.device_id} -> {self.last_server_version}"

