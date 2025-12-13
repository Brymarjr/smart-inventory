from inventory.models import Product
from sales.models import SaleItem
import pandas as pd
import numpy as np
from datetime import date, timedelta
from django.db.models import Sum, Avg


def generate_features_for_tenant(tenant):
    """
    Generate features for all products of a tenant.
    Features include lagged sales, rolling averages, volatility, stock levels, seasonal info, and anomalies.
    Returns:
        features: dict keyed by product.id, each containing a pandas DataFrame with features
    """
    features = {}
    products = Product.objects.filter(tenant=tenant)

    for product in products:
        # Fetch last 90 days of sales
        sales_qs = SaleItem.objects.filter(
            product=product,
            sale__tenant=tenant
        ).select_related("sale").order_by("sale__created_at")

        df = pd.DataFrame(list(
            sales_qs.values('sale__created_at', 'quantity')
        ))

        df.rename(
            columns={
                'sale__created_at': 'date',
                'quantity': 'quantity_sold',
            },
            inplace=True,
        )

        # If no sales exist, fallback to category average
        if df.empty:
            category_avg = Product.objects.filter(
                category=product.category, tenant=tenant
            ).annotate(total_sales=Sum('sales__quantity')).aggregate(
                avg_sales=Avg('total_sales')
            )['avg_sales'] or 0

            df = pd.DataFrame(
                {'quantity_sold': [category_avg]*30},
                index=pd.date_range(end=date.today(), periods=30)
            )
            df.index.name = 'date'
        else:
            df['date'] = pd.to_datetime(df['date'])
            df = df.sort_values('date')
            df = df.set_index('date').resample('D').sum().fillna(0)

        # Lag features
        df['lag_1'] = df['quantity_sold'].shift(1).fillna(0)
        df['lag_7'] = df['quantity_sold'].shift(7).fillna(0)
        df['lag_30'] = df['quantity_sold'].shift(30).fillna(0)

        # Rolling features
        df['rolling_7'] = df['quantity_sold'].rolling(window=7).mean().fillna(0)
        df['rolling_30'] = df['quantity_sold'].rolling(window=30).mean().fillna(0)
        df['volatility_7'] = df['quantity_sold'].rolling(window=7).std().fillna(0)

        # Seasonal features
        df['day_of_week'] = df.index.dayofweek
        df['month'] = df.index.month
        df['week_of_year'] = df.index.isocalendar().week

        # Confidence intervals
        df['ci_min'] = (df['rolling_30'] - df['volatility_7']).clip(lower=0)
        df['ci_max'] = df['rolling_30'] + df['volatility_7']

        # Anomaly detection
        mean = df['quantity_sold'].mean()
        std = df['quantity_sold'].std()
        df['anomaly'] = ((df['quantity_sold'] - mean).abs() > 2*std)

        features[product.id] = df

    return features


def compute_reorder_quantity(predicted_quantity, safety_stock=0, ci_min=None):
    """
    Calculate reorder quantity based on predicted quantity and optional safety stock.
    Uses the lower bound of confidence interval if provided for conservative planning.
    """
    if ci_min is None:
        ci_min = predicted_quantity

    reorder_qty = max(ci_min + safety_stock, 0)
    return reorder_qty


def detect_anomalies(sales_series):
    """
    Simple anomaly detection using z-score.
    Flags points where sales deviate significantly from mean.
    """
    mean = sales_series.mean()
    std = sales_series.std()
    z_scores = (sales_series - mean) / std
    anomalies = sales_series[np.abs(z_scores) > 2]
    return anomalies.index.tolist()
