from inventory.models import SupplierPrice

def get_best_procurement_recommendation(tenant, product):
    """
    Scans all known suppliers for a product and finds the cheapest one.
    """
    best_option = SupplierPrice.objects.filter(
        tenant=tenant, 
        product=product
    ).order_by('supply_price').first()

    if best_option:
        return {
            "supplier_name": best_option.supplier.name,
            "supplier_id": best_option.supplier.id,
            "best_price": best_option.supply_price,
            "savings_vs_current": product.cost_price - best_option.supply_price
        }
    return None