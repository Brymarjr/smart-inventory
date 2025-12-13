import datetime
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.db import transaction, IntegrityError
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from django.conf import settings
from django.apps import apps
from . import models as sync_models
from . import serializers as sync_serializers
from core.mixins import TenantFilteredViewSet
from .tasks import _apply_sync_operation_preflight, process_sync_job  # Celery task
from rest_framework.generics import GenericAPIView


class DeviceViewSet(TenantFilteredViewSet, viewsets.ModelViewSet):
    """
    Register and manage client devices.
    """
    queryset = sync_models.Device.objects.all()
    serializer_class = sync_serializers.DeviceSerializer
    permission_classes = [IsAuthenticated]


class SyncJobViewSet(TenantFilteredViewSet, viewsets.ReadOnlyModelViewSet):
    """
    Read-only access to SyncJob for job status polling.
    """
    queryset = sync_models.SyncJob.objects.all().select_related("submitted_by", "device")
    serializer_class = sync_serializers.SyncJobSerializer
    permission_classes = [IsAuthenticated]


class SyncUploadView(GenericAPIView):
    """
    Accepts an upload of client operations, creates a SyncJob and SyncOperation rows,
    and enqueues a Celery task to process the job.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = sync_serializers.SyncUploadSerializer

    def post(self, request, *args, **kwargs):
        serializer = sync_serializers.SyncUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Find or create device
        device_id = data["device_id"]
        device, created = sync_models.Device.objects.get_or_create(
            tenant=request.user.tenant,
            device_id=device_id,
            defaults={"user": request.user, "name": device_id}
        )

        # Reassign user if needed
        if device.user != request.user:
            device.user = request.user
            device.save(update_fields=["user"])

        # -----------------------------
        # Create SyncJob first so tmp_id_map can be used
        # -----------------------------
        try:
            with transaction.atomic():
                job = sync_models.SyncJob.objects.create(
                    tenant=request.user.tenant,
                    submitted_by=request.user,
                    device=device,
                )

                # Ensure tmp_id_map exists
                if not hasattr(job, "tmp_id_map") or not isinstance(job.tmp_id_map, dict):
                    job.tmp_id_map = {}

                # Preflight and prepare operations
                ops_to_create = []
                for op_data in data["client_ops"]:
                    op_dummy = sync_models.SyncOperation(
                        sync_job=job,
                        client_change_id=op_data["client_change_id"],
                        model_name=op_data["model_name"],
                        action=op_data["action"],
                        payload=op_data["payload"]
                    )

                    preflight_result = _apply_sync_operation_preflight(
                        job=job,
                        op=op_dummy,
                        tenant=request.user.tenant,
                        user=request.user
                    )

                    if not preflight_result["success"]:
                        return Response(
                            {"detail": "Preflight validation failed", "error": preflight_result["error"]},
                            status=status.HTTP_400_BAD_REQUEST,
                        )

                    # Apply NOOP mapping for unique objects immediately
                    noop_id = preflight_result.get("noop_map_existing_id")
                    tmp_id = op_data["payload"].get("tmp_id") or op_data.get("client_change_id")
                    if noop_id and tmp_id:
                        job.tmp_id_map[tmp_id] = noop_id

                    ops_to_create.append(
                        sync_models.SyncOperation(
                            sync_job=job,
                            client_change_id=op_data["client_change_id"],
                            model_name=op_data["model_name"],
                            action=op_data["action"],
                            payload=op_data["payload"],
                        )
                    )

                # Bulk create operations
                sync_models.SyncOperation.objects.bulk_create(ops_to_create)

        except IntegrityError as exc:
            return Response(
                {"detail": "Failed to create sync job/operations", "error": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Enqueue processing asynchronously
        try:
            process_sync_job.delay(job.id)
        except Exception as e:
            job.mark_failed({"error": "celery_enqueue_failed", "details": str(e)})
            return Response(
                {"detail": "Failed to enqueue sync job for processing"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response(
            {"job_id": job.id, "status": job.status},
            status=status.HTTP_202_ACCEPTED,
        )




class SyncDownloadView(APIView):
    """
    Returns all records from selected models updated since last_sync timestamp.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        device_id = request.query_params.get("device_id")
        last_sync = request.query_params.get("last_sync")

        if not device_id:
            return Response({"detail": "device_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        # get device
        device = sync_models.Device.objects.filter(
            tenant=request.user.tenant, device_id=device_id
        ).first()
        if not device:
            return Response({"detail": "Device not registered"}, status=status.HTTP_404_NOT_FOUND)

        # parse last_sync time
        try:
            last_sync_dt = datetime.datetime.fromisoformat(last_sync) if last_sync else timezone.make_aware(datetime.datetime.min)
        except Exception:
            return Response({"detail": "Invalid last_sync format"}, status=status.HTTP_400_BAD_REQUEST)

        # gather updates
        updated_data = {}
        for model_path in getattr(settings, "SYNCED_MODELS", []):
            app_label, model_name = model_path.split(".")
            model = apps.get_model(app_label, model_name)

            # filter by tenant and last modified date
            qs = model.objects.filter(
                tenant=request.user.tenant,
                updated_at__gt=last_sync_dt
            )

            serializer_class_name = f"{model.__name__}Serializer"
            serializer_class = getattr(sync_serializers, serializer_class_name, None)
            if not serializer_class:
                continue

            updated_data[model_name.lower()] = serializer_class(qs, many=True).data

        # update device last_sync
        device.last_sync = timezone.now()
        device.save(update_fields=["last_sync"])

        return Response({
            "device_id": device.device_id,
            "synced_at": timezone.now().isoformat(),
            "data": updated_data
        }, status=status.HTTP_200_OK)