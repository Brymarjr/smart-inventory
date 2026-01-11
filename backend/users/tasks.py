# users/tasks.py

from celery import shared_task
from django.core.mail import send_mail
from django.conf import settings

@shared_task
def send_password_reset_email(user_id, temp_password):
    """
    Sends the temporary password to the user's email asynchronously.
    """
    from django.contrib.auth import get_user_model
    User = get_user_model()

    try:
        user = User.objects.get(id=user_id)
        subject = "Smart Inventory - Password Reset"
        message = (
            f"Hello {user.first_name or user.username},\n\n"
            f"Your temporary password is: {temp_password}\n\n"
            "Use this password to log in, then you will be prompted to set a new password.\n\n"
            "If you did not request this, please contact your admin immediately.\n\n"
            "Smart Inventory Team"
        )
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            fail_silently=False,
        )
    except User.DoesNotExist:
        # Do nothing if user no longer exists
        pass
