from celery import shared_task
from django.contrib.auth import get_user_model
from inventory.models import Product
from notifications.models import Notification
from notifications.tasks import send_notification_email  # your working email task

User = get_user_model()


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=10, retry_kwargs={"max_retries": 3})
def notify_low_stock(self, product_id):
    """
    Tenant-aware low stock notification:
    - Creates in-app notifications
    - Sends email using the unified notification email system
    """
    try:
        product = Product.objects.select_related("tenant").get(pk=product_id)
    except Product.DoesNotExist:
        return

    tenant = product.tenant

    # Who should receive low stock alerts
    recipients = User.objects.filter(
        tenant=tenant,
        role__name__in=["tenant_admin", "manager"],
        is_active=True,
    )

    if not recipients.exists():
        return

    title = f"Low stock alert: {product.name}"
    message = (
        f"The product '{product.name}' is running low on stock.\n\n"
        f"Current quantity: {product.quantity}\n"
        f"Product ID: {product.id}"
    )

    notifications = []

    for user in recipients:
        notifications.append(
            Notification(
                tenant=tenant,
                recipient=user,
                title=title,
                message=message,
                notification_type="inventory",
            )
        )

    Notification.objects.bulk_create(notifications)

    # Send emails (asynchronously)
    for n in notifications:
        send_notification_email.delay(n.id)
