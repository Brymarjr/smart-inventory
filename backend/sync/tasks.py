# backend/sync/tasks.py
import copy
import json
from celery import shared_task
from django.db import transaction, IntegrityError
from django.utils import timezone
from django.apps import apps
from django.conf import settings
from django.db import models
from . import models as sync_models
from django.core.exceptions import ObjectDoesNotExist
from django.db.models.fields.related import ForeignKey as DjangoFK
from django.utils.dateparse import parse_datetime
from notifications.models import Notification
from notifications.tasks import send_notification_email
from users.models import User
import logging


logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=10)
def process_sync_job(self, job_id: int):
    """
    Celery task to process a SyncJob and its operations.
    Each operation is processed atomically so some ops may succeed while others fail.
    Tracks processed, succeeded, failed, and conflict counts.
    """
    try:
        job = sync_models.SyncJob.objects.select_related("tenant", "device", "submitted_by").get(id=job_id)
    except sync_models.SyncJob.DoesNotExist:
        logger.error("SyncJob %s not found", job_id)
        return

    job.mark_started()
    summary = {"processed": 0, "succeeded": 0, "failed": 0, "conflicts": 0, "errors": []}

    # Fetch operations in order
    operations = job.operations.select_related().all().order_by("id")

    for op in operations:
        if op.processed:
            continue

        summary["processed"] += 1

        try:
            # Isolate each operation in its own atomic transaction
            result = _apply_sync_operation(job, op)

            if result.get("success"):
                op.mark_processed(True, None)
                summary["succeeded"] += 1
            else:
                op.mark_processed(False, result.get("error"))
                summary["failed"] += 1
                summary["errors"].append({"op_id": op.id, "error": result.get("error")})

            if result.get("conflict"):
                summary["conflicts"] += 1

        except IntegrityError as exc:
            # Gracefully handle DB-level constraint violations
            op.mark_processed(False, str(exc))
            summary["failed"] += 1
            summary["errors"].append({"op_id": op.id, "error": str(exc)})
            logger.warning("IntegrityError processing op %s: %s", op.id, exc)

        except Exception as exc:
            # Catch-all: unexpected errors per op
            op.mark_processed(False, str(exc))
            summary["failed"] += 1
            summary["errors"].append({"op_id": op.id, "error": str(exc)})
            logger.exception("Error processing sync op %s: %s", op.id, exc)

    # Save job summary
    job.mark_completed(summary)
    
    # Notify admins if there were failures
    if summary["failed"] > 0:
        notify_sync_job_failed(job, summary)
        
    # Notify admins if there are unresolved conflicts
    if summary["conflicts"] > 0:
        notify_sync_conflicts(job, summary)
    
    logger.info("Processed SyncJob %s: %s", job.id, summary)
    return summary


def _apply_sync_operation(job: sync_models.SyncJob, op: sync_models.SyncOperation) -> dict:
    """
    Safe, dependency-aware application of one SyncOperation.
    Fixes included:
    - Payload deep copy so original is untouched
    - Proper tmp_id dependency blocking
    - Correct unique constraint checking
    - PATCH-safe updates
    - Clean conflict detection even if updated_at is missing
    """

    tenant = job.tenant
    submitted_by = getattr(job, "submitted_by", None)

    # -------------------------
    # Safe deep payload copy
    # -------------------------
    raw_payload = op.payload or {}
    if isinstance(raw_payload, str):
        try:
            raw_payload = json.loads(raw_payload)
        except Exception:
            raw_payload = {}

    payload = copy.deepcopy(raw_payload)

    # Ensure tmp_id map
    if not hasattr(job, "tmp_id_map") or not isinstance(job.tmp_id_map, dict):
        job.tmp_id_map = {}

    # -------------------------
    # Resolve model
    # -------------------------
    try:
        Model = apps.get_model(op.model_name)
    except Exception as exc:
        return {"success": False, "error": f"Failed to resolve model {op.model_name}: {exc}", "conflict": False}

    # -------------------------
    # Tenant injection
    # -------------------------
    payload.pop("tenant", None)
    payload["tenant_id"] = tenant.id

    # -------------------------
    # Handle *_tmp_id → *_id mapping
    # -------------------------
    pending_tmp_keys = []
    for key in list(payload.keys()):
        if key.endswith("_tmp_id"):
            base = key[:-7]
            tmp_val = payload.pop(key)
            fk_field = f"{base}_id"

            server_id = job.tmp_id_map.get(tmp_val)
            if server_id is not None:
                payload[fk_field] = server_id
            else:
                pending_tmp_keys.append((fk_field, tmp_val))

    tmp_client_id = payload.pop("tmp_id", None)

    # ------------------------------------------------------------
    # If this is a CREATE and FK dependencies are not ready → skip
    # ------------------------------------------------------------
    if op.action == sync_models.SyncOperation.ACTION_CREATE:
        if pending_tmp_keys:
            # FK dependencies not yet available
            return {
                "success": False,
                "error": f"pending_fk: waiting for tmp_ids {pending_tmp_keys}",
                "conflict": False,
            }

    # -------------------------
    # Preflight: field length
    # -------------------------
    for f in Model._meta.fields:
        if isinstance(f, models.CharField) and f.max_length:
            val = payload.get(f.name)
            if val is not None and len(str(val)) > f.max_length:
                return {
                    "success": False,
                    "error": f"Field '{f.name}' too long (max {f.max_length})",
                    "conflict": False,
                }

    # -------------------------
    # Preflight: required FK
    # -------------------------
    missing_required_fks = []
    for f in Model._meta.fields:
        if isinstance(f, models.ForeignKey) and not f.blank and not f.null:
            attname = f.get_attname()
            if payload.get(attname) in (None, ""):
                missing_required_fks.append(attname)

    if op.action == "create" and missing_required_fks:
        return {
            "success": False,
            "error": f"Missing required FK: {missing_required_fks}",
            "conflict": False,
        }

    # -------------------------
    # Preflight: unique constraints
    # -------------------------
    unique_fields = [f.name for f in Model._meta.fields if getattr(f, "unique", False)]
    unique_q = {}

    for field in unique_fields:
        val = payload.get(field)
        if val not in (None, ""):
            unique_q[field] = val

    if unique_q:
        if "tenant_id" in [f.name for f in Model._meta.fields]:
            unique_q["tenant_id"] = tenant.id

        existing = Model.objects.filter(**unique_q).first()
        if existing:
            # Map tmp_id → existing
            if tmp_client_id:
                job.tmp_id_map[tmp_client_id] = existing.id

            # Log noop
            sync_models.ChangeLog.objects.create(
                tenant=tenant,
                model=op.model_name,
                model_id=existing.id,
                action="noop_map_existing",
                payload={k: v for k, v in payload.items() if k != "tenant_id"},
            )

            return {"success": True, "error": None, "conflict": False}

    # ============================================================
    # APPLY OPERATION
    # ============================================================
    try:
        with transaction.atomic():

            # --------------------------------------------------
            # CREATE
            # --------------------------------------------------
            if op.action == sync_models.SyncOperation.ACTION_CREATE:
                obj = Model.objects.create(**payload)

                if tmp_client_id:
                    job.tmp_id_map[tmp_client_id] = getattr(obj, "id", None)
                    # Persist tmp_id_map so next operations see the mapping
                    job.save(update_fields=["tmp_id_map"])


                sync_models.ChangeLog.objects.create(
                    tenant=tenant,
                    model=op.model_name,
                    model_id=obj.id,
                    action="create",
                    payload={k: v for k, v in payload.items() if k != "tenant_id"},
                )

                return {"success": True, "error": None, "conflict": False}

            # --------------------------------------------------
            # UPDATE
            # --------------------------------------------------
            elif op.action == sync_models.SyncOperation.ACTION_UPDATE:
                pk = payload.get("id") or payload.get("pk")
                if not pk:
                    return {"success": False, "error": "Update missing PK", "conflict": False}

                qs = Model.objects.filter(tenant_id=tenant.id)
                obj = qs.select_for_update().get(pk=pk)

                # Conflict detection
                conflict_detected = False
                client_ts = payload.get("client_updated_at")
                server_ts = getattr(obj, "updated_at", None)

                if client_ts and server_ts:
                    client_dt = parse_datetime(client_ts)
                    if client_dt and server_ts > client_dt:
                        conflict_detected = True

                # Patch-safe update
                writable_payload = {
                    k: v for k, v in payload.items()
                    if k not in ("id", "pk", "client_updated_at")
                }

                for field, value in writable_payload.items():
                    if hasattr(obj, field):
                        setattr(obj, field, value)

                obj.save()

                sync_models.ChangeLog.objects.create(
                    tenant=tenant,
                    model=op.model_name,
                    model_id=obj.id,
                    action="update",
                    payload=writable_payload,
                )

                if conflict_detected:
                    sync_models.SyncConflict.objects.create(
                        sync_operation=op,
                        server_snapshot=_serialize_instance(obj),
                        client_payload=payload,
                        resolved=False,
                    )
                    return {"success": True, "error": None, "conflict": True}

                return {"success": True, "error": None, "conflict": False}

            # --------------------------------------------------
            # DELETE
            # --------------------------------------------------
            elif op.action == sync_models.SyncOperation.ACTION_DELETE:
                pk = payload.get("id") or payload.get("pk")
                if not pk:
                    return {"success": False, "error": "Delete missing PK", "conflict": False}

                qs = Model.objects.filter(tenant_id=tenant.id)
                existing = qs.filter(pk=pk).first()

                if existing:
                    existing.delete()

                sync_models.ChangeLog.objects.create(
                    tenant=tenant,
                    model=op.model_name,
                    model_id=pk,
                    action="delete",
                    payload={k: v for k, v in payload.items() if k != "tenant_id"},
                )

                return {"success": True, "error": None, "conflict": False}

            else:
                return {"success": False, "error": f"Unknown action {op.action}", "conflict": False}

    except IntegrityError as exc:
        # Treat unique constraint violations as conflicts for CREATE operations
        error_str = str(exc)
        is_unique_violation = "unique constraint" in error_str.lower() or "unique violation" in error_str.lower()
    
        conflict_flag = False
        if op.action == sync_models.SyncOperation.ACTION_CREATE and is_unique_violation:
            conflict_flag = True  # mark as conflict

        return {"success": False, "error": error_str, "conflict": conflict_flag}

    except Exception as exc:
        return {"success": False, "error": str(exc), "conflict": False}




def _apply_sync_operation_preflight(job, op, tenant, user):
    """
    Preflight validation for a SyncOperation without making DB writes.
    - Treats existing unique-object matches as NOOP (Option A).
    - Validates CharField lengths, required FKs (respects tmp_id mapping when job provided),
      and unique constraints.
    Returns a dict:
        {
          "success": bool,
          "error": str|None,
          "pending_tmp_ids": [(fk_attname, tmp_id_str), ...],   # when unresolved tmp refs exist
          "noop_map_existing_id": int|None                      # when unique match found
        }
    """
    import json
    from django.apps import apps
    from django.db import models as dj_models

    model_path = getattr(op, "model_name", None)
    action = getattr(op, "action", None)
    payload = getattr(op, "payload", None) or {}

    # ensure payload dict
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except Exception:
            payload = {}
    if not isinstance(payload, dict):
        payload = {}

    # Remove client-provided tenant and inject authoritative tenant_id
    payload.pop("tenant", None)
    payload["tenant_id"] = getattr(tenant, "id", None)

    # Ensure job.tmp_id_map exists if job provided
    tmp_map = {}
    if job is not None and hasattr(job, "tmp_id_map") and isinstance(job.tmp_id_map, dict):
        tmp_map = job.tmp_id_map

    # Resolve model class
    try:
        Model = apps.get_model(*model_path.split(".")) if "." in model_path else apps.get_model(model_path)
    except Exception as exc:
        return {"success": False, "error": f"Model resolution failed: {exc}"}

    # Gather pending tmp-id references (and allow pre-resolving them if tmp_map contains mapping)
    pending_tmp_ids = []
    for k in list(payload.keys()):
        if k.endswith("_tmp_id"):
            base = k[:-7]  # e.g. category_tmp_id -> 'category'
            tmp_val = payload.pop(k, None)
            fk_attname = f"{base}_id"
            if tmp_val is None:
                continue
            mapped = tmp_map.get(tmp_val)
            if mapped is not None:
                # inject mapped id into payload so preflight can validate using numeric fk
                if payload.get(fk_attname) in (None, ""):
                    payload[fk_attname] = mapped
            else:
                pending_tmp_ids.append((fk_attname, tmp_val))

    # -------------------
    # Field length validation (CharField)
    # -------------------
    try:
        for f in Model._meta.fields:
            if isinstance(f, dj_models.CharField) and getattr(f, "max_length", None):
                # model field name (not attname) may be used in payload
                fname = f.name
                val = payload.get(fname)
                if val is not None and len(str(val)) > f.max_length:
                    return {
                        "success": False,
                        "error": f"Preflight validation failed: field '{fname}' too long (max {f.max_length})",
                        "pending_tmp_ids": pending_tmp_ids,
                        "noop_map_existing_id": None,
                    }
    except Exception as exc:
        return {"success": False, "error": f"Preflight validation failed: {exc}", "pending_tmp_ids": pending_tmp_ids, "noop_map_existing_id": None}

    # -------------------
    # Required FK validation (respect pending tmp ids)
    # -------------------
    try:
        missing_required_fks = []
        for f in Model._meta.fields:
            # ForeignKey class from dj_models
            if isinstance(f, dj_models.ForeignKey):
                attname = f.get_attname()  # e.g., 'category_id'
                # required if NOT NULL/blank and no default
                if not f.null and not f.blank:
                    if payload.get(attname) in (None, ""):
                        # if this attname is covered by pending_tmp_ids, it's ok for preflight to flag as pending
                        attempted = any(pk for pk in pending_tmp_ids if pk[0] == attname)
                        if not attempted:
                            missing_required_fks.append(attname)
        if action == sync_models.SyncOperation.ACTION_CREATE and missing_required_fks:
            return {
                "success": False,
                "error": f"Missing required FK fields for {model_path}: {', '.join(missing_required_fks)}",
                "pending_tmp_ids": pending_tmp_ids,
                "noop_map_existing_id": None,
            }
    except Exception as exc:
        return {"success": False, "error": f"Preflight validation failed: {exc}", "pending_tmp_ids": pending_tmp_ids, "noop_map_existing_id": None}

    # -------------------
    # Unique constraint handling (Option A: NOOP -> success & mapping)
    # -------------------
    try:
        unique_fields = [f.name for f in Model._meta.fields if getattr(f, "unique", False)]
        unique_q = {f: payload[f] for f in unique_fields if payload.get(f) not in (None, "")}
        if unique_q:
            # scope to tenant if model has tenant FK
            if "tenant_id" in [f.name for f in Model._meta.fields]:
                unique_q["tenant_id"] = payload.get("tenant_id")
            try:
                existing = Model.objects.filter(**unique_q).first()
            except Exception:
                existing = None
            if existing:
                # Map client tmp_id (if provided) to existing id for caller's benefit
                noop_map_id = getattr(existing, "id", None)
                return {
                    "success": True,
                    "error": None,
                    "pending_tmp_ids": pending_tmp_ids,
                    "noop_map_existing_id": noop_map_id,
                }
    except Exception as exc:
        return {"success": False, "error": f"Preflight validation failed: {exc}", "pending_tmp_ids": pending_tmp_ids, "noop_map_existing_id": None}

    # All checks passed - return success and any pending tmp ids
    return {"success": True, "error": None, "pending_tmp_ids": pending_tmp_ids, "noop_map_existing_id": None}



def _serialize_instance(instance):
    """
    Lightweight JSON serialization for conflict auditing.
    Uses short model name instead of full app_label.ModelName for readability.
    """
    data = {"id": getattr(instance, "id", None)}
    # Add all model fields
    for field in getattr(instance, "_meta").fields:
        name = field.name
        try:
            val = getattr(instance, name)
            # For relations, only store PK
            if hasattr(val, "pk"):
                val = getattr(val, "pk", None)
            data[name] = val
        except Exception:
            data[name] = None
    # Add short model name
    data["_model"] = instance._meta.model_name  # e.g., "category" instead of "inventory.Category"
    return data


def _update_cursor_for_device(device, server_version):
    """
    Ensure SyncCursor exists and update last_server_version safely.
    """
    if not device or not server_version:
        return
    cursor, _ = sync_models.SyncCursor.objects.get_or_create(
        tenant=device.tenant,
        device=device,
        defaults={"last_server_version": server_version}
    )
    if server_version > (cursor.last_server_version or 0):
        cursor.last_server_version = server_version
        cursor.save(update_fields=["last_server_version", "updated_at"])


def notify_sync_job_failed(sync_job, reason=None):
    """
    Notify tenant admins and managers when a sync job fails.
    """
    tenant = sync_job.tenant

    recipients = User.objects.filter(
        tenant=tenant,
        role__name__in=["tenant_admin", "manager"],
        is_active=True,
    )

    if not recipients.exists():
        logger.warning(f"No recipients for failed sync job {sync_job.id}")
        return

    for user in recipients:
        message = (
            f"A device sync has failed.\n\n"
            f"Device: {sync_job.device.name if sync_job.device else 'Unknown'}\n"
            f"Job ID: {sync_job.id}\n"
        )

        if reason:
            message += f"\nReason: {reason}"

        notification = Notification.objects.create(
            tenant=tenant,
            recipient=user,
            title="Sync Failed",
            message=message,
            notification_type="sync",
        )

        send_notification_email.delay(notification.id)

    logger.info(f"🔔 Sync failure notification sent for job {sync_job.id}")


def notify_sync_conflicts(job, summary):
    """
    Notify tenant admins/managers that sync conflicts require manual resolution.
    """
    tenant = job.tenant

    recipients = User.objects.filter(
        tenant=tenant,
        role__name__in=["tenant_admin", "manager"],
        is_active=True,
    )

    if not recipients.exists():
        return

    for user in recipients:
        notification = Notification.objects.create(
            tenant=tenant,
            recipient=user,
            title="Sync conflict requires attention",
            message=(
                f"A sync operation from device '{job.device.name}' "
                f"completed with {summary['conflicts']} unresolved conflict(s).\n\n"
                f"These conflicts require manual resolution in the admin dashboard."
            ),
            notification_type="sync",
        )

        send_notification_email.delay(notification.id)

    logger.info(
        "🔔 Sync conflict notification sent for job %s (%s conflicts)",
        job.id,
        summary["conflicts"],
    )
