import csv
from datetime import date, timedelta
from django.db.models import Sum, F
from decimal import Decimal
from sales.models import SaleItem
from inventory.models import Product
from forecast.models import InventoryAnomaly

def get_monthly_metrics(tenant):
    today = date.today()
    start_date = today.replace(day=1) - timedelta(days=1)
    # Get last month's range
    month_start = start_date.replace(day=1)
    month_end = start_date

    sales = SaleItem.objects.filter(
        sale__tenant=tenant,
        sale__created_at__date__range=[month_start, month_end]
    )

    revenue = sales.aggregate(total=Sum('subtotal'))['total'] or Decimal('0.00')
    
    # Calculate Profit: (Unit Price - Cost Price) * Qty
    profit = sales.annotate(
        item_profit=(F('unit_price') - F('product__cost_price')) * F('quantity')
    ).aggregate(total=Sum('item_profit'))['total'] or Decimal('0.00')

    top_product = sales.values('product__name').annotate(
        total_qty=Sum('quantity')
    ).order_by('-total_qty').first()

    anomalies_count = InventoryAnomaly.objects.filter(
        tenant=tenant, 
        detected_at__date__range=[month_start, month_end]
    ).count()

    return {
        "tenant_name": tenant.name,
        "period": month_start.strftime("%B %Y"),
        "revenue": revenue,
        "profit": profit,
        "top_product": top_product['product__name'] if top_product else "N/A",
        "anomalies_flagged": anomalies_count,
        "margin": round((profit / revenue * 100), 2) if revenue > 0 else 0
    }