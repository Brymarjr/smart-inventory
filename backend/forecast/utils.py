import numpy as np
import pandas as pd
from datetime import date, timedelta
from django.db.models import Sum
from sales.models import SaleItem

def get_clean_sales_data(tenant, product, days=90):
    """
    Fetch sales data and IMPUTE missing demand.
    Crucial Fix: Forces the timeline to end TODAY, so recent drop-offs (theft) are visible.
    """
    # 1. Fetch Sales
    sales_qs = SaleItem.objects.filter(
        product=product, 
        sale__tenant=tenant,
        sale__created_at__gte=date.today() - timedelta(days=days)
    ).values('sale__created_at__date').annotate(qty=Sum('quantity'))

    # 2. Convert to DataFrame
    df = pd.DataFrame(list(sales_qs))
    
    # ✅ FIX: Create a strict date range ending TODAY
    # This ensures that if sales stopped 10 days ago, we see 10 rows of "0" at the end.
    end_date = pd.to_datetime(date.today())
    start_date = end_date - timedelta(days=days-1)
    full_index = pd.date_range(start=start_date, end=end_date, freq='D')

    if df.empty:
        # Return an empty DF with the correct index/columns to prevent crashes
        return pd.DataFrame({'qty': 0, 'adjusted_qty': 0}, index=full_index)

    # Map database results to the full date range
    df['date'] = pd.to_datetime(df['sale__created_at__date'])
    df = df.set_index('date').reindex(full_index, fill_value=0)
    
    # 3. STOCKOUT INTELLIGENCE
    # If sales are 0, we check if it was a stockout or just low demand.
    # For simplicity here, we assume 0 means 0 demand unless defined otherwise.
    # We add a rolling average for smoothing.
    df['rolling_avg'] = df['qty'].rolling(window=7, min_periods=1).mean()
    df['adjusted_qty'] = np.where(df['qty'] == 0, df['rolling_avg'], df['qty'])
    
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