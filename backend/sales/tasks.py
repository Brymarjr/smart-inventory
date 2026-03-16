from celery import shared_task
from django.contrib.auth import get_user_model
from django.db.models import Sum
from django.utils import timezone
from datetime import timedelta
from inventory.models import Product
from notifications.models import Notification
from notifications.tasks import send_notification_email  # working email task
from tenants.models import TenantSettings 
from sales.models import Sale

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

    # Check if the Tenant actually wants these alerts!
    try:
        settings = TenantSettings.objects.get(tenant=tenant)
        if not settings.low_stock_alerts:
            # The toggle is OFF! Stop right here and don't send anything.
            return
    except TenantSettings.DoesNotExist:
        pass # If no settings exist yet, default to sending the alert

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
        
        
@shared_task
def send_weekly_reports():
    """
    Runs automatically every week via Celery Beat.
    Sends a summary of the last 7 days to tenants who opted in.
    Uses the unified Notification system to deliver both in-app alerts and emails.
    """
    # 1. ONLY get tenants who flipped the switch to TRUE
    active_settings = TenantSettings.objects.filter(weekly_reports=True).select_related('tenant')
    
    now = timezone.now()
    seven_days_ago = now - timedelta(days=7)
    
    notifications_to_create = []

    for settings in active_settings:
        tenant = settings.tenant
        
        # 2. Find who should get the report
        recipients = User.objects.filter(
            tenant=tenant,
            role__name__in=["tenant_admin", "manager"],
            is_active=True
        )
        
        if not recipients.exists():
            continue

        # 3. Calculate the weekly sales data
        weekly_sales = Sale.objects.filter(
            tenant=tenant, 
            created_at__gte=seven_days_ago
        )
        
        total_revenue = weekly_sales.aggregate(total=Sum('total_amount'))['total'] or 0
        total_transactions = weekly_sales.count()

        # 4. Format the notification content
        title = f"Weekly Sales Report: {settings.store_name or tenant.name}"
        message = (
            f"Here is your sales summary for the last 7 days:\n"
            f"-------------------------------------------------\n"
            f"Total Revenue: {settings.currency_symbol}{total_revenue}\n"
            f"Total Transactions: {total_transactions}\n"
            f"-------------------------------------------------\n\n"
            f"Check your Analytics Dashboard for a deeper breakdown."
        )

        # 5. Queue up the Notification objects
        for user in recipients:
            notifications_to_create.append(
                Notification(
                    tenant=tenant,
                    recipient=user,
                    title=title,
                    message=message,
                    notification_type="system",  # Fits best from your NOTIFICATION_TYPES
                )
            )

    # 6. Bulk create to save DB queries, then trigger the email workers
    if notifications_to_create:
        # bulk_create returns the objects with their IDs in modern Django
        created_notifications = Notification.objects.bulk_create(notifications_to_create)
        
        for n in created_notifications:
            send_notification_email.delay(n.id)
            
    return f"Processed weekly reports for {active_settings.count()} tenants."