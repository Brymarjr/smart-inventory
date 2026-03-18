# users/tasks.py

from celery import shared_task
from django.conf import settings
from notifications.models import Notification
from notifications.tasks import send_notification_email

@shared_task
def send_password_reset_email(user_id, temp_password):
    """
    Creates a formal system notification for password reset, 
    which then triggers the structured email system.
    """
    from django.contrib.auth import get_user_model
    User = get_user_model()

    try:
        user = User.objects.get(id=user_id)
        
        title = "Password Reset - Temporary Access"
        message = (
            f"Hello {user.first_name or user.username},\n\n"
            f"Your temporary password is: {temp_password}\n\n"
            "Use this password to log in. You will be prompted to set a new password immediately.\n\n"
            "If you did not request this, please contact your admin."
        )

        # 1. Create the notification in the DB (targeted ONLY to this user)
        notification = Notification.objects.create(
            tenant=user.tenant,
            recipient=user,
            title=title,
            message=message,
            notification_type="system", # Matches your model's choices
        )

        # 2. Trigger your defined email task for this specific notification
        send_notification_email.delay(notification.id)

    except User.DoesNotExist:
        pass