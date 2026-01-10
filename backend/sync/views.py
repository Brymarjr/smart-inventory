import datetime
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.db import transaction, IntegrityError
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.generics import GenericAPIView
from django.conf import settings
from django.apps import apps
from . import models as sync_models
from . import serializers as sync_serializers
from core.mixins import TenantFilteredViewSet
from users.permissions import IsTenantAdmin
from .tasks import _apply_sync_operation_preflight, process_sync_job
from .notifications import notify_device_unblocked
import logging

logger = logging.getLogger(__name__)


class DeviceViewSet(TenantFilteredViewSet, viewsets.ModelViewSet):
    """
    Device management: List, View Status, Unblock.
    """
    queryset = sync_models.Device.objects.all()
    serializer_class = sync_serializers.DeviceSerializer
    permission_classes = [IsAuthenticated]
    
    def get_permissions(self):
        if self.action in ["unblock"]:
            return [IsAuthenticated(), IsTenantAdmin()]
        return super().get_permissions()

    @action(detail=True, methods=["post"])
    def unblock(self, request, pk=None):
        """
        Manually unblock a device after repeated sync failures.
        """
        device = self.get_object()

        if not device.is_blocked:
            return Response(
                {"detail": "Device is not blocked."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        device.is_blocked = False
        device.consecutive_failures = 0
        device.save(update_fields=["is_blocked", "consecutive_failures"])

        notify_device_unblocked(device)

        logger.info(f"🔓 Device {device.name} unblocked by {request.user.email}")

        return Response(
            {
                "detail": "Device successfully unblocked.",
                "device_id": device.id,
                "device_name": device.name,
            },
            status=status.HTTP_200_OK,
        )


class SyncJobViewSet(TenantFilteredViewSet, viewsets.ReadOnlyModelViewSet):
    """
    Read-only access to SyncJob for job status polling.
    """
    queryset = sync_models.SyncJob.objects.all().select_related("submitted_by", "device")
    serializer_class = sync_serializers.SyncJobSerializer
    permission_classes = [IsAuthenticated]


class SyncUploadView(GenericAPIView):
    """
    Accepts an upload of client operations.
    Auto-injects 'created_by_id' to satisfy FK requirements.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = sync_serializers.SyncUploadSerializer
    
    def post(self, request, *args, **kwargs):
        # 1. Validate Input Schema
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        device_id = data["device_id"]

        # 2. Auto-Provision Device
        device, created = sync_models.Device.objects.get_or_create(
            tenant=request.user.tenant,
            device_id=device_id,
            defaults={
                "user": request.user, 
                "name": f"POS-{device_id[:8]}"
            }
        )

        if device.user != request.user:
            device.user = request.user
            device.save(update_fields=["user"])

        if device.is_blocked:
            return Response(
                {"detail": "Device blocked.", "code": "device_blocked"},
                status=status.HTTP_403_FORBIDDEN
            )

        # 3. Create Job & Operations (Atomic)
        try:
            with transaction.atomic():
                job = sync_models.SyncJob.objects.create(
                    tenant=request.user.tenant,
                    submitted_by=request.user,
                    device=device,
                    tmp_id_map={} 
                )

                ops_to_create = []
                
                for op_data in data["client_ops"]:
                    
                    # ✅ THE FIX: Inject User ID for models that require it (like Sale)
                    if op_data["action"] == "create":
                        # This adds "created_by_id": 1 to the payload
                        # So the preflight check passes!
                        op_data["payload"]["created_by_id"] = request.user.id

                    op_dummy = sync_models.SyncOperation(
                        sync_job=job,
                        client_change_id=op_data["client_change_id"],
                        model_name=op_data["model_name"],
                        action=op_data["action"],
                        payload=op_data["payload"]
                    )

                    preflight = _apply_sync_operation_preflight(
                        job=job,
                        op=op_dummy,
                        tenant=request.user.tenant,
                        user=request.user
                    )

                    if not preflight["success"]:
                        raise ValueError(f"Preflight failed for {op_data['model_name']}: {preflight.get('error')}")

                    noop_id = preflight.get("noop_map_existing_id")
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

                if job.tmp_id_map:
                    job.save(update_fields=["tmp_id_map"])

                sync_models.SyncOperation.objects.bulk_create(ops_to_create)

        except (IntegrityError, ValueError) as exc:
            logger.warning(f"Sync upload rejected: {exc}")
            return Response(
                {"detail": "Invalid sync data", "error": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 4. Enqueue Processing
        try:
            process_sync_job.delay(job.id)
        except Exception as e:
            job.mark_failed({"error": "celery_enqueue_failed", "details": str(e)})
            return Response(
                {"detail": "System busy"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response(
            {"job_id": job.id, "status": job.status},
            status=status.HTTP_202_ACCEPTED,
        )


class SyncDownloadView(APIView):
    """
    Returns records updated since last_sync.
    Includes logic to handle models without 'updated_at' or direct 'tenant' fields.
    """
    permission_classes = [IsAuthenticated]

    def _get_tenant_filter(self, model, tenant):
        """
        Helper to determine how to filter a model by tenant.
        - If model has 'tenant' field -> tenant=tenant
        - If model is SaleItem -> sale__tenant=tenant
        - Else -> return None (or handle specific cases)
        """
        field_names = [f.name for f in model._meta.get_fields()]
        
        if 'tenant' in field_names:
            return {'tenant': tenant}
        
        # specific handling for nested items
        if model.__name__ == 'SaleItem':
            return {'sale__tenant': tenant}
            
        if model.__name__ == 'PurchaseItem':
            return {'purchase_order__tenant': tenant}

        # Fallback: If we can't filter by tenant, we shouldn't send data to be safe.
        return None

    def get(self, request, *args, **kwargs):
        device_id = request.query_params.get("device_id")
        last_sync = request.query_params.get("last_sync")

        if not device_id:
            return Response({"detail": "device_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Resolve & Auto-Provision Device
        device, created = sync_models.Device.objects.get_or_create(
            tenant=request.user.tenant,
            device_id=device_id,
            defaults={
                "user": request.user,
                "name": f"POS-{device_id[:8]}"
            }
        )
        
        if device.is_blocked:
            return Response({"detail": "Device blocked."}, status=status.HTTP_403_FORBIDDEN)

        # 2. Parse Timestamp
        try:
            if last_sync and last_sync != "null":
                last_sync_dt = datetime.datetime.fromisoformat(last_sync)
            else:
                last_sync_dt = timezone.make_aware(datetime.datetime.min)
        except Exception:
            return Response({"detail": "Invalid last_sync format"}, status=status.HTTP_400_BAD_REQUEST)

        # 3. Gather Updates
        updated_data = {}
        has_more_data = False
        limit_per_model = 1000

        for model_path in getattr(settings, "SYNCED_MODELS", []):
            try:
                app_label, model_name = model_path.split(".")
                model = apps.get_model(app_label, model_name)
            except LookupError:
                continue

            serializer_name = f"{model.__name__}Serializer"
            serializer_class = getattr(sync_serializers, serializer_name, None)
            
            if not serializer_class:
                continue

            # Determine Tenant Filter
            tenant_filter = self._get_tenant_filter(model, request.user.tenant)
            if tenant_filter is None:
                continue

            # Check timestamp existence
            field_names = [f.name for f in model._meta.get_fields()]
            
            if 'updated_at' in field_names:
                # Delta Sync
                qs = model.objects.filter(
                    **tenant_filter,
                    updated_at__gt=last_sync_dt
                ).order_by('updated_at')
            else:
                # Full Sync
                qs = model.objects.filter(**tenant_filter).order_by('id')

            # Apply Limits
            qs = qs[:limit_per_model + 1]
            records = list(qs)
            
            if len(records) > limit_per_model:
                has_more_data = True
                records = records[:limit_per_model]

            if records:
                updated_data[model_name.lower()] = serializer_class(records, many=True).data

        # 4. Update Device Activity
        device.last_seen = timezone.now()
        device.save(update_fields=["last_seen"])

        return Response({
            "device_id": device.device_id,
            "synced_at": timezone.now().isoformat(),
            "has_more": has_more_data,
            "data": updated_data
        }, status=status.HTTP_200_OK)