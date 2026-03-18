import csv
from datetime import date, timedelta
from django.db.models import Sum, F
from decimal import Decimal
from sales.models import SaleItem
from inventory.models import Product
from forecast.models import InventoryAnomaly

def get_monthly_metrics(tenant):
    today = date.today()
    start_date = today.replace(day=1)
    # Define the range for THIS current month to match the System Analytics View
    month_start = start_date
    month_end = today

    # Aggregate using SaleItem for precision
    sales_qs = SaleItem.objects.filter(
        sale__tenant=tenant,
        sale__created_at__date__range=[month_start, month_end]
    )

    # Calculate Revenue
    revenue = sales_qs.aggregate(total=Sum('subtotal'))['total'] or Decimal('0.00')
    
    # Calculate Profit: Sum of (Subtotal - (Cost * Quantity))
    # We use Coalesce/Value for cost_price fallback to 0 if not set
    profit_data = sales_qs.aggregate(
        total_profit=Sum(F('subtotal') - (F('product__cost_price') * F('quantity')))
    )
    profit = profit_data['total_profit'] or Decimal('0.00')

    top_product = sales_qs.values('product__name').annotate(
        total_qty=Sum('quantity')
    ).order_by('-total_qty').first()

    # Active anomalies for this tenant
    anomalies_count = InventoryAnomaly.objects.filter(
        tenant=tenant, 
        is_resolved=False
    ).count()

    return {
        "tenant_name": tenant.name,
        "tenant_id": tenant.id,
        "period": month_start.strftime("%B %Y"),
        "revenue": revenue,
        "profit": profit,
        "top_product": top_product['product__name'] if top_product else "N/A",
        "anomalies_flagged": anomalies_count,
        "margin": round((profit / revenue * 100), 2) if revenue > 0 else 0
    }