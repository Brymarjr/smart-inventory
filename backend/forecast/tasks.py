import numpy as np
import pandas as pd
import pickle
import os
from datetime import date, timedelta
from celery import shared_task
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.contrib.auth import get_user_model
from sklearn.linear_model import LinearRegression
from notifications.models import Notification
from notifications.tasks import send_notification_email

from tenants.models import Tenant
from inventory.models import Product
from forecast.models import ForecastModel, Forecast, InventoryAnomaly
from forecast.utils import get_clean_sales_data
from .reports import get_monthly_metrics

User = get_user_model()

def _get_model_dir():
    base_dir = os.path.join(settings.BASE_DIR, 'forecast', 'ml_models')
    os.makedirs(base_dir, exist_ok=True)
    return base_dir

@shared_task(bind=True)
def train_and_detect_anomalies(self, tenant_id):
    tenant = Tenant.objects.get(id=tenant_id)
    InventoryAnomaly.objects.filter(tenant=tenant).delete() # Clear old alerts
    
    model_registry = {} 
    products = Product.objects.filter(tenant=tenant)
    
    for product in products:
        df = get_clean_sales_data(tenant, product)
        
        # Date column normalization
        if 'date' not in df.columns:
            df = df.reset_index()
            for col in df.columns:
                if pd.api.types.is_datetime64_any_dtype(df[col]):
                    df = df.rename(columns={col: 'date'})
                    break
        
        if 'date' not in df.columns: continue

        # FORCE FILL ZEROS
        if not df.empty:
            df = df.set_index('date').resample('D').sum().fillna(0).reset_index()

        if df.empty or len(df) < 7: continue

        df['day_index'] = np.arange(len(df))
        for d in range(7):
            df[f'dow_{d}'] = (df['date'].dt.dayofweek == d).astype(int)

        y = df['adjusted_qty'].values
        data_points = len(y)
        avg_sales = df['adjusted_qty'].mean()
        
        model_info = {
            'type': 'insufficient_data',
            'last_day_index': df['day_index'].iloc[-1],
            'avg_sales': avg_sales,
            'model_obj': None,
            'slope': 0.0
        }

        # Training Phase
        if data_points < 14:
            model_info['type'] = 'average'
        elif data_points < 60:
            model_info['type'] = 'linear_trend'
            reg = LinearRegression()
            reg.fit(df[['day_index']], y)
            model_info['model_obj'] = reg
            model_info['slope'] = reg.coef_[0] 
        else:
            model_info['type'] = 'seasonal_trend'
            feature_cols = ['day_index'] + [f'dow_{d}' for d in range(7)]
            reg = LinearRegression()
            reg.fit(df[feature_cols], y)
            model_info['model_obj'] = reg
            model_info['slope'] = reg.coef_[0]

        model_registry[product.id] = model_info
        _detect_anomalies(tenant, product, df, model_info)

    # Save
    model_dir = _get_model_dir()
    model_path = os.path.join(model_dir, f"tenant_{tenant_id}_brain.pkl")
    with open(model_path, 'wb') as f:
        pickle.dump(model_registry, f)
        
    ForecastModel.objects.update_or_create(
        tenant=tenant, model_type='evolutionary_v1',
        defaults={'file_path': model_path, 'version': 4, 'trained_at': timezone.now()}
    )

def _detect_anomalies(tenant, product, df, model_info):
    detected_types = []
    
    # 1. STOCKOUT RISK (Priority)
    # FIX: Use RECENT velocity (last 7 days), not 90-day average. 
    # If the product started selling fast recently, we need to know!
    recent_velocity = df['adjusted_qty'].tail(7).mean()
    
    # Use recent velocity if valid, otherwise fallback to long-term average
    velocity = recent_velocity if recent_velocity > 0 else model_info['avg_sales']
    
    if velocity > 0.1: 
        days_cover = product.quantity / velocity
        
        # Threshold: Warn if less than 14 days of stock left
        if days_cover < 14:
            InventoryAnomaly.objects.create(
                tenant=tenant, product=product, 
                anomaly_type='stockout_risk', severity='high',
                description=f"Critical Low Stock: {product.quantity} units left. Selling ~{velocity:.1f}/day (Cover: {days_cover:.1f} days)."
            )
            detected_types.append('stockout')

    # 2. VELOCITY SPIKE
    recent_max = df['adjusted_qty'].tail(3).max()
    threshold = model_info['avg_sales'] * 4 
    
    if recent_max > threshold and recent_max > 10:
        if 'stockout' not in detected_types:
            InventoryAnomaly.objects.create(
                tenant=tenant, product=product, 
                anomaly_type='velocity_spike', severity='low',
                description=f"Velocity Spike: Sales hit {recent_max} recently (Normal: ~{model_info['avg_sales']:.1f})."
            )

    # 3. GHOST STOCK
    recent_sum = df['adjusted_qty'].tail(7).sum()
    if 'stockout' not in detected_types: 
        # Kept the 0.5 threshold from our previous success
        if product.quantity > 10 and model_info['avg_sales'] > 0.5 and recent_sum == 0:
            InventoryAnomaly.objects.create(
                tenant=tenant, product=product, 
                anomaly_type='shrinkage', severity='medium',
                description=f"Ghost Stock: 0 sales in 7 days. Stock is {product.quantity}. Normally sells {model_info['avg_sales']:.1f}/day."
            )


@shared_task(bind=True)
def generate_daily_forecasts(self, tenant_id):
    """
    Uses the brain to predict tomorrow. 
    (Anomaly detection removed from here to prevent conflicts)
    """
    tenant = Tenant.objects.get(id=tenant_id)
    
    try:
        model_rec = ForecastModel.objects.get(tenant=tenant, model_type='evolutionary_v1')
        with open(model_rec.file_path, 'rb') as f:
            model_registry = pickle.load(f)
    except ForecastModel.DoesNotExist:
        return "No brain found."

    today = timezone.now().date()
    
    with transaction.atomic():
        Forecast.objects.filter(tenant=tenant, prediction_date__lt=today).delete()

        for product in Product.objects.filter(tenant=tenant):
            info = model_registry.get(product.id)
            if not info: continue
            
            tomorrow = today + timedelta(days=1)
            next_day_index = info['last_day_index'] + 1
            predicted_qty = 0
            reason = "Insuff. Data"

            if info['type'] == 'average':
                predicted_qty = info['avg_sales']
                reason = "Based on average"

            elif info['type'] == 'linear_trend':
                reg = info['model_obj']
                predicted_qty = reg.predict(pd.DataFrame({'day_index': [next_day_index]}))[0]
                slope = info['slope']
                reason = "Trending Up 📈" if slope > 0.05 else "Trending Down 📉"

            elif info['type'] == 'seasonal_trend':
                reg = info['model_obj']
                dow = tomorrow.weekday()
                input_data = {'day_index': [next_day_index]}
                for d in range(7):
                    input_data[f'dow_{d}'] = [1 if d == dow else 0]
                
                predicted_qty = reg.predict(pd.DataFrame(input_data))[0]
                day_name = tomorrow.strftime("%A")
                reason = f"{day_name} Pattern"

            predicted_qty = max(0, round(predicted_qty, 1))

            Forecast.objects.update_or_create(
                tenant=tenant, product=product, prediction_date=tomorrow,
                defaults={'predicted_quantity': predicted_qty, 'reasoning': reason}
            )

@shared_task
def run_analytics_for_all(sync=False):
    for t in Tenant.objects.all():
        if sync:
            train_and_detect_anomalies(t.id)
            generate_daily_forecasts(t.id)
        else:
            train_and_detect_anomalies.delay(t.id)
            generate_daily_forecasts.delay(t.id)
            
            
@shared_task
def send_monthly_intelligence_reports():
    """
    Runs on the 1st of every month via Celery Beat.
    Sends deep AI-driven business intelligence to admins and managers.
    """
    tenants = Tenant.objects.all()
    notifications_to_create = []
    
    for tenant in tenants:
        # 1. Get the meaningful data from our reporting logic
        try:
            stats = get_monthly_metrics(tenant)
        except Exception as e:
            print(f"Error generating metrics for {tenant.name}: {e}")
            continue

        # 2. Get recipients (Admins and Managers)
        recipients = User.objects.filter(
            tenant=tenant,
            role__name__in=["tenant_admin", "manager"],
            is_active=True
        )

        if not recipients.exists():
            continue

        # 3. Format the message using the data from get_monthly_metrics
        # We try to get currency symbol from settings if it exists
        settings = getattr(tenant, 'settings', None)
        currency = settings.currency_symbol if settings else "₦"
        
        title = f"Monthly Intelligence Report: {stats['period']}"
        message = (
            f"Your business performance summary for {stats['period']}:\n"
            f"-------------------------------------------------\n"
            f"💰 Total Revenue: {currency}{stats['revenue']:,.2f}\n"
            f"📈 Total Profit: {currency}{stats['profit']:,.2f}\n"
            f"📊 Net Margin: {stats['margin']}%\n"
            f"🏆 Top Product: {stats['top_product']}\n"
            f"🚨 AI Anomalies Flagged: {stats['anomalies_flagged']}\n"
            f"-------------------------------------------------\n\n"
            f"Log in to the Intelligence Center to view detailed charts and reorder recommendations."
        )

        # 4. Queue up notifications
        for user in recipients:
            notifications_to_create.append(
                Notification(
                    tenant=tenant,
                    recipient=user,
                    title=title,
                    message=message,
                    notification_type="system",
                )
            )

    # 5. Bulk execute and trigger email tasks
    if notifications_to_create:
        created_notifications = Notification.objects.bulk_create(notifications_to_create)
        for n in created_notifications:
            # This triggers your existing notification email task
            send_notification_email.delay(n.id)

    return f"Sent monthly intelligence reports to {len(tenants)} tenants."