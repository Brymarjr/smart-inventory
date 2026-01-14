"""
Sync Views Module.

This module implements the **Offline-First Synchronization Engine**.
It allows the frontend Point of Sale (POS) to operate without internet and
sync data back to the server when connection is restored.

Key Components:
1.  **Device Management:** Authenticates and tracks physical POS terminals.
2.  **Upload (Push):** Receives a batch of offline actions (e.g., Sales created offline)
    and processes them transactionally.
3.  **Download (Pull):** Sends only *changed* data (Delta Sync) back to the client
    to keep local databases up to date.
"""

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
from rest_framework_simplejwt.authentication import JWTAuthentication  # ✅ REQUIRED for Token Auth
from django.conf import settings
from django.apps import apps
from . import models as sync_models
from . import serializers as sync_serializers
from core.mixins import TenantFilteredViewSet
from users.permissions import IsTenantAdmin
from .tasks import _apply_sync_operation_preflight, process_sync_job
from .notifications import notify_device_unblocked
import logging

# ✅ PRODUCTION LOGGING SETUP
logger = logging.getLogger(__name__)
logger.info("🚀 NEW SYNC VIEW CODE LOADED - JWT Auth Active")

class DeviceViewSet(TenantFilteredViewSet, viewsets.ModelViewSet):
    """
    Manages physical Point of Sale (POS) devices.

    Used to:
    - Register new terminals.
    - Monitor "Blocked" devices (security mechanism for failed sync spam).
    - Manually Unblock devices via Admin UI.
    """
    queryset = sync_models.Device.objects.all()
    serializer_class = sync_serializers.DeviceSerializer
    permission_classes = [IsAuthenticated]
    
    def get_permissions(self):
        """
        Standard users can list devices, but ONLY Tenant Admins can unblock them.
        """
        if self.action in ["unblock"]:
            return [IsAuthenticated(), IsTenantAdmin()]
        return super().get_permissions()

    @action(detail=True, methods=["post"])
    def unblock(self, request, pk=None):
        """
        Manually resets a blocked device.
        
        Resets `consecutive_failures` to 0 and sets `is_blocked=False`.
        Triggers a notification to the staff using that device.
        """
        device = self.get_object()
        if not device.is_blocked:
            return Response({"detail": "Device is not blocked."}, status=status.HTTP_400_BAD_REQUEST)

        device.is_blocked = False
        device.consecutive_failures = 0
        device.save(update_fields=["is_blocked", "consecutive_failures"])

        notify_device_unblocked(device)
        return Response({"detail": "Device successfully unblocked.", "device_id": device.id}, status=status.HTTP_200_OK)


class SyncJobViewSet(TenantFilteredViewSet, viewsets.ReadOnlyModelViewSet):
    """
    Read-Only view of Sync History.
    
    Allows admins to audit past sync attempts, see which succeeded, 
    and debug why specific jobs failed.
    """
    queryset = sync_models.SyncJob.objects.all().select_related("submitted_by", "device")
    serializer_class = sync_serializers.SyncJobSerializer
    permission_classes = [IsAuthenticated]


class SyncUploadView(GenericAPIView):
    """
    The Core "Push" Endpoint (Client -> Server).

    Accepts a JSON payload containing a list of operations performed offline
    (e.g., Created Sale #1, Updated Product #5).

    Key Logic:
    1.  **Auto-Provisioning:** Creates a Device record if it doesn't exist.
    2.  **Transactional Write:** All operations are saved to a `SyncJob` container first.
    3.  **Preflight Check:** Validates data integrity before queuing.
    4.  **Temp ID Mapping:** Resolves temporary offline IDs (e.g., 'temp_123') 
        to real Database IDs if the object was already synced previously.
    """
    authentication_classes = [JWTAuthentication] # ✅ FORCE TOKEN AUTH
    permission_classes = [IsAuthenticated]
    serializer_class = sync_serializers.SyncUploadSerializer
    
    def post(self, request, *args, **kwargs):
        # 1. Validate Input
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        device_id = data["device_id"]

        # 2. Auto-Provision Device
        device, created = sync_models.Device.objects.get_or_create(
            tenant=request.user.tenant,
            device_id=device_id,
            defaults={"user": request.user, "name": f"POS-{device_id[:8]}"}
        )
        if device.user != request.user:
            device.user = request.user
            device.save(update_fields=["user"])

        if device.is_blocked:
            return Response({"detail": "Device blocked.", "code": "device_blocked"}, status=status.HTTP_403_FORBIDDEN)

        # 3. Create Job & Operations
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
                    
                    try:
                        app_label, model_name = op_data["model_name"].split(".")
                        Model = apps.get_model(app_label, model_name)
                    except LookupError:
                        Model = None

                    # If creating a record, force the creator to be the current user
                    if Model and op_data["action"] == "create":
                        field_names = [f.name for f in Model._meta.get_fields()]
                        if 'created_by' in field_names:
                            op_data["payload"]["created_by_id"] = request.user.id

                    op_dummy = sync_models.SyncOperation(
                        sync_job=job,
                        client_change_id=op_data["client_change_id"],
                        model_name=op_data["model_name"],
                        action=op_data["action"],
                        payload=op_data["payload"]
                    )

                    # Check if this operation is valid or redundant (No-Op)
                    preflight = _apply_sync_operation_preflight(
                        job=job, op=op_dummy, tenant=request.user.tenant, user=request.user
                    )

                    if not preflight["success"]:
                        raise ValueError(f"Preflight failed for {op_data['model_name']}: {preflight.get('error')}")

                    noop_id = preflight.get("noop_map_existing_id")
                    tmp_id = op_data["payload"].get("tmp_id") or op_data.get("client_change_id")
                    
                    # If this temp_id was already synced before, map it to the real ID
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
            return Response({"detail": "Invalid sync data", "error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        # 4. Offload heavy processing to Celery
        try:
            process_sync_job.delay(job.id)
        except Exception as e:
            job.mark_failed({"error": "celery_enqueue_failed", "details": str(e)})
            return Response({"detail": "System busy"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        return Response({"job_id": job.id, "status": job.status}, status=status.HTTP_202_ACCEPTED)


class SyncDownloadView(APIView):
    """
    The Core "Pull" Endpoint (Server -> Client).

    Implements **Delta Sync**:
    - The client sends `last_sync` timestamp.
    - The server returns ONLY records updated *after* that timestamp.
    
    This ensures we don't re-download the entire database every time.
    """
    authentication_classes = [JWTAuthentication] # ✅ FORCE TOKEN AUTH
    permission_classes = [IsAuthenticated]

    def _get_tenant_filter(self, model, tenant):
        """
        Dynamically determines how to filter a model by Tenant.
        Handles direct relationships (model.tenant) and indirect ones (SaleItem.sale.tenant).
        """
        field_names = [f.name for f in model._meta.get_fields()]
        if 'tenant' in field_names: return {'tenant': tenant}
        if model.__name__ == 'SaleItem': return {'sale__tenant': tenant}
        if model.__name__ == 'PurchaseItem': return {'purchase_order__tenant': tenant}
        return None

    def get(self, request, *args, **kwargs):
        # 🔍 DEBUG: Log user identity
        logger.info(f"🔍 SyncDownload Request by User: {request.user}")
        
        device_id = request.query_params.get("device_id")
        last_sync = request.query_params.get("last_sync")

        if not device_id:
            return Response({"detail": "device_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        device, created = sync_models.Device.objects.get_or_create(
            tenant=request.user.tenant,
            device_id=device_id,
            defaults={"user": request.user, "name": f"POS-{device_id[:8]}"}
        )
        
        if device.is_blocked:
            return Response({"detail": "Device blocked."}, status=status.HTTP_403_FORBIDDEN)

        try:
            if last_sync and last_sync != "null":
                last_sync_dt = datetime.datetime.fromisoformat(last_sync)
            else:
                last_sync_dt = timezone.make_aware(datetime.datetime.min)
        except Exception:
            return Response({"detail": "Invalid last_sync format"}, status=status.HTTP_400_BAD_REQUEST)

        updated_data = {}
        has_more_data = False
        limit_per_model = 1000

        # Iterate over all models defined in settings.SYNCED_MODELS
        for model_path in getattr(settings, "SYNCED_MODELS", []):
            try:
                app_label, model_name = model_path.split(".")
                model = apps.get_model(app_label, model_name)
            except LookupError:
                continue

            serializer_name = f"{model.__name__}Serializer"
            serializer_class = getattr(sync_serializers, serializer_name, None)
            
            if not serializer_class: continue

            tenant_filter = self._get_tenant_filter(model, request.user.tenant)
            if tenant_filter is None: continue

            field_names = [f.name for f in model._meta.get_fields()]
            
            # Filter logic: Get items newer than last_sync
            if 'updated_at' in field_names:
                qs = model.objects.filter(**tenant_filter, updated_at__gt=last_sync_dt).order_by('updated_at')
            else:
                qs = model.objects.filter(**tenant_filter).order_by('id')

            # Pagination Logic (Limit 1000 per model)
            qs = qs[:limit_per_model + 1]
            records = list(qs)
            
            if len(records) > limit_per_model:
                has_more_data = True
                records = records[:limit_per_model]

            if records:
                updated_data[model_name.lower()] = serializer_class(records, many=True).data

        device.last_seen = timezone.now()
        device.save(update_fields=["last_seen"])

        return Response({
            "device_id": device.device_id,
            "synced_at": timezone.now().isoformat(),
            "has_more": has_more_data,
            "data": updated_data
        }, status=status.HTTP_200_OK)