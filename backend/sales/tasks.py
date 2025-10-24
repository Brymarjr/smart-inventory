from celery import shared_task
from inventory.models import Product
from django.core.mail import send_mail
from django.conf import settings

@shared_task
def notify_low_stock(product_id):
    """
    Placeholder: notify admins / tenant owners that a product is low on stock.
    Wire this into your tenant notification system later (email, Slack, etc.)
    """
    try:
        p = Product.objects.get(pk=product_id)
    except Product.DoesNotExist:
        return

    # Example simple email; replace with your tenant-aware notification system
    subject = f"[Low stock] Product {p.pk} — {p.name}"
    message = f"Product {p.name} (ID: {p.pk}) now has low stock: {getattr(p, 'stock', 'unknown')}."
    admin_emails = getattr(settings, 'ADMINS_EMAILS', [])
    if admin_emails:
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, admin_emails)
    # Expand: create Notification records, emit websockets, Slack messages, etc.
