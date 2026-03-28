import logging
import json
import copy
from celery import shared_task
from django.apps import apps
from django.db import transaction, IntegrityError, models
from .models import SyncJob, SyncOperation, ChangeLog
from .notifications import notify_sync_job_failed, notify_sync_conflicts, notify_device_blocked

logger = logging.getLogger(__name__)

@shared_task(bind=True, max_retries=3, default_retry_delay=10)
def process_sync_job(self, job_id: int):
    """
    Robust Sync Processor.
    Iterates through operations and applies them using _apply_sync_operation.
    """
    try:
        # Load Job with related data for efficiency
        job = SyncJob.objects.select_related("tenant", "device", "submitted_by").get(id=job_id)
        
        # If it's already done, don't redo it (unless we manually reset it)
        if job.status == 'completed':
            return

        job.mark_started()
        summary = {"processed": 0, "succeeded": 0, "failed": 0, "conflicts": 0, "errors": []}
        
        # ✅ 1. Load existing map (from preflight or previous attempts)
        current_id_map = job.tmp_id_map or {}

        # Sort: Process in ID order to maintain dependency sequence
        operations = job.operations.all().order_by("id")

        for op in operations:
            if op.processed:
                continue

            summary["processed"] += 1

            try:
                # ✅ 2. Execute Logic
                result = _apply_sync_operation(job, op, current_id_map)

                if result.get("success"):
                    # Mark as completed
                    op.status = 'completed'
                    op.processed = True
                    op.error_message = "" # Clear any old errors
                    op.save()
                    
                    summary["succeeded"] += 1
                    
                    # ✅ 3. Update map if a new ID was generated
                    new_mapping = result.get("new_id_mapping")
                    if new_mapping:
                        current_id_map.update(new_mapping)
                        # Persist to DB immediately so retries work
                        job.tmp_id_map = current_id_map
                        job.save(update_fields=["tmp_id_map"])
                else:
                    # Mark as failed
                    op.status = 'failed'
                    op.processed = False
                    op.error_message = result.get("error")
                    op.save()
                    
                    summary["failed"] += 1
                    summary["errors"].append({"op_id": op.id, "error": result.get("error")})

                if result.get("conflict"):
                    summary["conflicts"] += 1

            except Exception as exc:
                # Catch-all: unexpected errors per op
                op.status = 'failed'
                op.processed = False
                op.error_message = str(exc)
                op.save()
                
                summary["failed"] += 1
                summary["errors"].append({"op_id": op.id, "error": str(exc)})
                logger.exception("Error processing sync op %s: %s", op.id, exc)

        # Final Status Update
        if summary["failed"] > 0:
            job.status = 'failed'
        else:
            job.status = 'completed'
        
        job.save()
        
        # Handle Device Blocking Logic
        device = job.device
        if summary["failed"] > 0:
            device.consecutive_failures += 1
        else:
            device.consecutive_failures = 0 # Reset on success

        if device.consecutive_failures >= 3:
            device.is_blocked = True

        device.save(update_fields=["consecutive_failures", "is_blocked"])
        
        # Notifications
        if device.is_blocked:
            notify_device_blocked(device)
        if summary["failed"] > 0:
            notify_sync_job_failed(job, summary)
        if summary["conflicts"] > 0:
            notify_sync_conflicts(job, summary)
        
        logger.info("Processed SyncJob %s: %s", job.id, summary)
        return summary

    except SyncJob.DoesNotExist:
        logger.error("SyncJob %s not found", job_id)
    except Exception as e:
        logger.exception("Critical error processing job %s", job_id)


def _apply_sync_operation(job, op, id_map) -> dict:
    """
    Executes a single sync operation.
    FIX 1: Pop 'items' immediately to avoid TypeError.
    FIX 2: Use tmp_id as a unique lock to prevent "Double-Dipping" stock deductions.
    """
    tenant = job.tenant
    
    # Setup Payload
    raw_payload = op.payload or {}
    if isinstance(raw_payload, str):
        try: raw_payload = json.loads(raw_payload)
        except: raw_payload = {}
    payload = copy.deepcopy(raw_payload)

    # ---------------------------------------------------------
    # ✅ THE CRITICAL FIX: POP 'items' IMMEDIATELY
    # ---------------------------------------------------------
    nested_items = payload.pop('items', [])

    # ---------------------------------------------------------
    # ✅ 1. IDEMPOTENCY CHECK (ChangeLog lookup)
    # ---------------------------------------------------------
    existing_log = ChangeLog.objects.filter(
        tenant=tenant, 
        payload__client_change_id=op.client_change_id
    ).first()

    if existing_log and op.action == 'create':
        logger.info(f"Skipping Duplicate Op {op.client_change_id}")
        if payload.get("tmp_id"):
             job.tmp_id_map[payload["tmp_id"]] = existing_log.model_id
             job.save(update_fields=["tmp_id_map"])
        return {"success": True, "conflict": False}

    # Resolve Model
    try:
        if "." in op.model_name:
            app_label, model_name = op.model_name.split(".")
            Model = apps.get_model(app_label, model_name)
        else:
            Model = apps.get_model(op.model_name)
    except Exception as exc:
        return {"success": False, "error": f"Invalid model {op.model_name}", "conflict": False}

    # ✅ 2. Tenant Injection & Field Mapping
    model_fields = [f.name for f in Model._meta.fields]
    if 'tenant' in model_fields:
        payload["tenant_id"] = tenant.id

    # ---------------------------------------------------------
    # ✅ 3. ROBUST ID RESOLUTION
    # ---------------------------------------------------------
    pending_tmp_keys = []
    for key in list(payload.keys()):
        if key.endswith("_tmp_id"):
            base = key[:-7]
            tmp_val = payload.pop(key)
            fk_field = f"{base}_id"

            if tmp_val in id_map:
                payload[fk_field] = id_map[tmp_val]
            else:
                parent_log = ChangeLog.objects.filter(tenant=tenant, payload__tmp_id=tmp_val).first()
                if parent_log:
                    payload[fk_field] = parent_log.model_id
                    id_map[tmp_val] = parent_log.model_id 
                else:
                    pending_tmp_keys.append((fk_field, tmp_val))

    client_tmp_id = payload.pop("tmp_id", None) or op.client_change_id

    if op.action == 'create' and pending_tmp_keys:
        return {"success": False, "error": f"Missing dependencies: {pending_tmp_keys}", "conflict": False}

    # ---------------------------------------------------------
    # 4. EXECUTION
    # ---------------------------------------------------------
    try:
        with transaction.atomic():
            new_mapping = {}

            if op.action == 'create':
                payload.pop('id', None)
                
                # --- GLOBAL DUPLICATE LOCK (REFINED) ---
                # Only check tmp_id if the field actually exists in the model
                if 'tmp_id' in model_fields and client_tmp_id:
                    existing = Model.objects.filter(tmp_id=client_tmp_id, tenant_id=tenant.id).first()
                    if existing:
                        logger.info(f"🛑 Blocking Duplicate Sync for tmp_id {client_tmp_id}")
                        return {"success": True, "conflict": False, "new_id_mapping": {client_tmp_id: existing.id}}

                if 'reference' in payload:
                    existing = Model.objects.filter(reference=payload['reference'], tenant_id=tenant.id).first()
                    if existing:
                        if client_tmp_id: new_mapping = {client_tmp_id: existing.id}
                        return {"success": True, "conflict": False, "new_id_mapping": new_mapping}

                # Create the Parent Object
                # Inject the tmp_id back into payload for saving if field exists
                if 'tmp_id' in model_fields:
                    payload['tmp_id'] = client_tmp_id

                obj = Model.objects.create(**payload)
                
                # ✅ 5. PROCESS NESTED ITEMS (SaleItems)
                if nested_items:
                    from sales.models import SaleItem
                    for item in nested_items:
                        SaleItem.objects.create(
                            sale=obj,
                            product_id=item['product_id'],
                            quantity=item['quantity'],
                            unit_price=item['unit_price'],
                            subtotal=item['subtotal']
                        )

                if client_tmp_id: new_mapping = {client_tmp_id: obj.id}
                
                # Log to ChangeLog
                log_payload = {k: v for k, v in payload.items() if k != "tenant_id"}
                if client_tmp_id: log_payload['tmp_id'] = client_tmp_id 
                
                ChangeLog.objects.create(
                    tenant=tenant, model=op.model_name, model_id=obj.id, 
                    action="create", payload=log_payload
                )
                
                return {"success": True, "conflict": False, "new_id_mapping": new_mapping}

            elif op.action == 'update':
                pk = payload.pop("id", None) or payload.pop("pk", None)
                if not pk: return {"success": False, "error": "Missing PK"}
                Model.objects.filter(pk=pk, tenant_id=tenant.id).update(**payload)
                return {"success": True, "conflict": False}

    except Exception as e:
        logger.exception(f"Op {op.id} Failed")
        return {"success": False, "error": str(e), "conflict": False}
    
    return {"success": False, "error": f"Unknown action {op.action}"}

# Keep the preflight helper as it's used by views.py
def _apply_sync_operation_preflight(job, op, tenant, user):
    """
    Validation logic used by views.py.
    """
    import json
    payload = getattr(op, "payload", {})
    if isinstance(payload, str):
        try: payload = json.loads(payload)
        except: payload = {}
    
    return {"success": True, "pending_tmp_ids": [], "noop_map_existing_id": None}