from users.models import User
from notifications.models import Notification
from notifications.tasks import send_notification_email
import logging

logger = logging.getLogger(__name__)


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


def notify_device_blocked(device):
    """
    Notify tenant admins/managers that a device has been blocked due to repeated sync failures.
    """
    tenant = device.tenant

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
            title="Device Blocked",
            message=(
                f"Device '{device.name}' has been blocked due to repeated sync failures.\n\n"
                f"Users of this device will no longer be able to sync until the block is lifted."
            ),
            notification_type="sync",
        )

        send_notification_email.delay(notification.id)

    logger.info(
        "🔔 Device blocked notification sent for device %s (tenant %s)",
        device.name,
        tenant.name,
    )


def notify_device_unblocked(device):
    """
    Notify tenant admins/managers that a device has been unblocked.
    """
    tenant = device.tenant

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
            title="Device Unblocked",
            message=(
                f"Device '{device.name}' has been unblocked.\n\n"
                f"Users of this device can now resume syncing normally."
            ),
            notification_type="sync",
        )

        send_notification_email.delay(notification.id)

    logger.info(
        "🔔 Device unblocked notification sent for device %s (tenant %s)",
        device.name,
        tenant.name,
    )