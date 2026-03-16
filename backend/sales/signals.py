from django.db.models.signals import post_save
from django.dispatch import receiver
from django.conf import settings
from django.db import transaction
import logging

from .models import SaleItem
from inventory.models import Product 
from sales.tasks import notify_low_stock

logger = logging.getLogger(__name__)

@receiver(post_save, sender=SaleItem, dispatch_uid="deduct_stock_on_sale_item_create")
def update_stock_on_sale(sender, instance, created, **kwargs):
    """
    Deducts stock from Inventory when a SaleItem is created.
    Universally triggers the low stock Celery task.
    """
    if created:
        try:
            with transaction.atomic():
                # Lock row to prevent race conditions
                product = Product.objects.select_for_update().get(id=instance.product.id)
                
                old_qty = product.quantity
                product.quantity -= instance.quantity
                product.save()

                logger.info(f"📉 Stock Update: Product {product.name} decreased by {instance.quantity}")
                logger.info(f"📉 Stock adjusted for Product {product.id}: {old_qty} -> {product.quantity}")

                # ✅ Check threshold and fire Celery Task universally
                threshold = getattr(product, 'reorder_level', getattr(settings, 'DEFAULT_LOW_STOCK_THRESHOLD', 10))
                
                if product.quantity <= threshold:
                    logger.info(f"⚠️ Low stock threshold reached for Product {product.id}. Triggering alert.")
                    notify_low_stock.delay(product.id)

        except Product.DoesNotExist:
            logger.error(f"❌ Stock Update Failed: Product {instance.product_id} not found")
        except Exception as e:
            logger.error(f"❌ Stock Update Error: {str(e)}")