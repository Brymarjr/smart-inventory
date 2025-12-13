# sync/middleware.py
import json
import logging
from django.utils import timezone

logger = logging.getLogger("sync")


class SyncActivityLoggerMiddleware:
    """
    Logs all sync upload and download API requests for auditing and monitoring.
    Only triggers for paths starting with /api/sync/.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Only track sync endpoints
        if request.path.startswith("/api/sync/"):
            user = getattr(request, "user", None)
            username = user.username if user and user.is_authenticated else "anonymous"
            ip_address = (
                request.META.get("REMOTE_ADDR")
                or request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0]
                or "unknown"
            )
            method = request.method
            start_time = timezone.now()

            # Safely extract device_id from GET or JSON body
            device_id = request.GET.get("device_id")
            if not device_id and request.method in ["POST", "PUT", "PATCH"]:
                try:
                    body_data = json.loads(request.body.decode("utf-8") or "{}")
                    device_id = body_data.get("device_id")
                except Exception:
                    device_id = None

            # Process request
            response = self.get_response(request)
            duration = (timezone.now() - start_time).total_seconds()

            # Log sync activity
            logger.info(
                f"[SYNC] {method} {request.path} by '{username}' "
                f"device={device_id or 'N/A'} ip={ip_address} "
                f"status={response.status_code} duration={duration:.2f}s"
            )

            return response

        # For non-sync paths, just continue
        return self.get_response(request)

