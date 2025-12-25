# users/notifications.py

from users.models import User
from notifications.models import Notification
from notifications.tasks import send_notification_email
import logging

logger = logging.getLogger(__name__)

def notify_password_changed(user):
    """
    Notify the user and all tenant admins when a password is changed.
    """
    tenant = user.tenant

    recipients = User.objects.filter(
        tenant=tenant,
        is_active=True,
    )

    if not recipients.exists():
        logger.warning(f"No recipients for password change for user {user.id}")
        return

    for recipient in recipients:
        message = (
            f"User {user.get_full_name()} changed their password."
            if recipient != user else
            "You changed your password."
        )

        notification = Notification.objects.create(
            tenant=tenant,
            recipient=recipient,
            title="Password Changed",
            message=message,
            notification_type="security",
        )

        send_notification_email.delay(notification.id)

    logger.info(f"🔔 Password change notification sent for user {user.id}")


def notify_role_changed(user, new_role):
    """
    Notify the affected user and tenant admins when a role is changed.
    """
    tenant = user.tenant

    recipients = User.objects.filter(
        tenant=tenant,
        is_active=True,
    )

    if not recipients.exists():
        logger.warning(f"No recipients for role change for user {user.id}")
        return

    for recipient in recipients:
        if recipient == user:
            message = f"Your role has been updated to {new_role}."
        else:
            message = f"User {user.get_full_name()} role updated to {new_role}."

        notification = Notification.objects.create(
            tenant=tenant,
            recipient=recipient,
            title="Role Changed",
            message=message,
            notification_type="security",
        )

        send_notification_email.delay(notification.id)

    logger.info(f"🔔 Role change notification sent for user {user.id}")
