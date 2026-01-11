# placeholder for future hooks (stock transactions, audit logs)
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import PurchaseOrder

@receiver(post_save, sender=PurchaseOrder)
def purchase_order_post_save(sender, instance, created, **kwargs):
    # example: enqueue audit log or notifications
    if created:
        # TODO: send notification to tenant admins
        pass
