# notifications/utils.py

from .models import Notification
from .tasks import send_notification_email


def notify_user(*, tenant, recipient, title, message, notification_type, send_email=True):
    """
    Create in-app notification and optionally send email
    """
    # 1. Create the notification record in the database
    notification = Notification.objects.create(
        tenant=tenant,
        recipient=recipient,
        title=title,
        message=message,
        notification_type=notification_type,
    )

    # 2. Trigger the async task using the ID
    if send_email and recipient.email:
        # The task will fetch the object using this ID.
        send_notification_email.delay(notification.id)

    return notification
