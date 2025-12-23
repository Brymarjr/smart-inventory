# notifications/utils.py

from .models import Notification
from .tasks import send_notification_email


def notify_user(*, tenant, recipient, title, message, notification_type, send_email=True):
    """
    Create in-app notification and optionally send email
    """

    notification = Notification.objects.create(
        tenant=tenant,
        recipient=recipient,
        title=title,
        message=message,
        notification_type=notification_type,
    )

    if send_email and recipient.email:
        send_notification_email.delay(
            to_email=recipient.email,
            subject=title,
            message=message,
        )

    return notification
