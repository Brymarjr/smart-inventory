from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import SaleItem
from inventory.models import Product 
# REMOVED: ProductMovement from the import above
from django.db import transaction
import logging

logger = logging.getLogger(__name__)

# ✅ dispatch_uid prevents double registration
@receiver(post_save, sender=SaleItem, dispatch_uid="deduct_stock_on_sale_item_create")
def update_stock_on_sale(sender, instance, created, **kwargs):
    """
    Deducts stock from Inventory when a SaleItem is created.
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

        except Product.DoesNotExist:
            logger.error(f"❌ Stock Update Failed: Product {instance.product_id} not found")
        except Exception as e:
            logger.error(f"❌ Stock Update Error: {str(e)}")