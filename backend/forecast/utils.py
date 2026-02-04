import numpy as np
import pandas as pd
from datetime import date, timedelta
from django.db.models import Sum
from sales.models import SaleItem

def get_clean_sales_data(tenant, product, days=90):
    """
    Fetch raw sales data. 
    CRITICAL FIX: Do NOT smooth out zeros. We need the AI to see the zeros 
    to detect 'Ghost Stock' and the raw spikes for 'Velocity Spike'.
    """
    # 1. Fetch Sales
    sales_qs = SaleItem.objects.filter(
        product=product, 
        sale__tenant=tenant,
        sale__created_at__gte=date.today() - timedelta(days=days)
    ).values('sale__created_at__date').annotate(qty=Sum('quantity'))

    # 2. Convert to DataFrame
    df = pd.DataFrame(list(sales_qs))
    
    # Create strict timeline ending TODAY
    end_date = pd.to_datetime(date.today())
    start_date = end_date - timedelta(days=days) 
    full_index = pd.date_range(start=start_date, end=end_date, freq='D')

    if df.empty:
        # Return empty frame with correct structure
        df_empty = pd.DataFrame({'qty': 0, 'adjusted_qty': 0}, index=full_index)
        return df_empty.reset_index().rename(columns={'index': 'date'})

    # Map results to the full date range
    df['date'] = pd.to_datetime(df['sale__created_at__date'])
    df = df.set_index('date').reindex(full_index, fill_value=0)
    
    # 3. THE FIX: RAW REALITY
    # Previously, we replaced 0s with averages. This hid the "Ghost Stock".
    # Now, we pass the raw 'qty' as 'adjusted_qty' so the AI sees the sudden drop to 0.
    df['adjusted_qty'] = df['qty']
    
    # Add column for index access if needed
    df = df.reset_index().rename(columns={'index': 'date'})
    
    return df

def calculate_dynamic_reorder_point(df, lead_time_days=3):
    if df.empty:
        return 0, 0
    avg_daily_sales = df['adjusted_qty'].mean()
    sales_std_dev = df['adjusted_qty'].std()
    
    # Service Level 95% (Z=1.65)
    z_score = 1.65 
    safety_stock = z_score * sales_std_dev * np.sqrt(lead_time_days)
    
    reorder_point = (avg_daily_sales * lead_time_days) + safety_stock
    return round(reorder_point), round(safety_stock)