from celery import shared_task
from django.core.mail import send_mail
from django.conf import settings
from .models import Notification


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={"max_retries": 3})
def send_notification_email(self, notification_id):
    """
    Send an email for a stored notification.
    """
    try:
        notification = Notification.objects.select_related("recipient").get(
            id=notification_id
        )
    except Notification.DoesNotExist:
        return  # safe exit

    recipient = notification.recipient

    if not recipient.email:
        return

    send_mail(
        subject=notification.title,
        message=notification.message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[recipient.email],
        fail_silently=False,
    )
