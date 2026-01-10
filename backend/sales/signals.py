from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.db.models import F
from .models import SaleItem
from inventory.models import Product

@receiver(post_save, sender=SaleItem)
def update_stock_on_sale(sender, instance, created, **kwargs):
    """
    When a SaleItem is created, subtract the quantity from the Product.
    """
    if created:
        # Subtract stock
        Product.objects.filter(pk=instance.product.id).update(
            quantity=F('quantity') - instance.quantity
        )