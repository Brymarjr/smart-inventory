import numpy as np
import pandas as pd
import pickle
import os
from datetime import date, timedelta
from celery import shared_task
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from sklearn.linear_model import LinearRegression

from tenants.models import Tenant
from inventory.models import Product
from forecast.models import ForecastModel, Forecast, InventoryAnomaly
from forecast.utils import get_clean_sales_data

def _get_model_dir():
    base_dir = os.path.join(settings.BASE_DIR, 'forecast', 'ml_models')
    os.makedirs(base_dir, exist_ok=True)
    return base_dir

@shared_task(bind=True)
def train_and_detect_anomalies(self, tenant_id):
    """
    EVOLUTIONARY AI ENGINE:
    - Phase 1 (<14 days): Average only.
    - Phase 2 (14-60 days): Linear Trend.
    - Phase 3 (>60 days): Trend + Weekly Seasonality (Day of Week).
    """
    tenant = Tenant.objects.get(id=tenant_id)
    
    # Wipe old alerts so we don't get duplicates tomorrow
    # The AI will re-discover any valid issues in milliseconds anyway.
    InventoryAnomaly.objects.filter(tenant=tenant).delete()
    
    model_registry = {} 
    
    products = Product.objects.filter(tenant=tenant)
    
    for product in products:
        # --- 1. DATA PREP ---
        df = get_clean_sales_data(tenant, product)
        
        # ✅ FIX: ENSURE 'date' IS A COLUMN (Handle Index issues)
        if 'date' not in df.columns:
            df = df.reset_index() # Move index to column
            # Rename the datetime column to 'date' if it has a different name (e.g. 'created_at')
            for col in df.columns:
                if pd.api.types.is_datetime64_any_dtype(df[col]):
                    df = df.rename(columns={col: 'date'})
                    break

        # Check again: if we still don't have 'date', skip
        if 'date' not in df.columns:
            continue

        # Guard Clause: Need at least 7 days
        if df.empty or len(df) < 7:
            continue

        # Feature Engineering: Add "Day Index"
        df['day_index'] = np.arange(len(df))
        
        # Feature Engineering: Add "Day of Week" (One-Hot Encoding)
        # We need this for Seasonality (IsMon, IsTue...)
        for d in range(7):
            df[f'dow_{d}'] = (df['date'].dt.dayofweek == d).astype(int)

        y = df['adjusted_qty'].values
        data_points = len(y)
        avg_sales = df['adjusted_qty'].mean()
        volatility = df['adjusted_qty'].std()
        
        model_info = {
            'type': 'insufficient_data',
            'last_day_index': df['day_index'].iloc[-1],
            'avg_sales': avg_sales,
            'volatility': volatility,
            'model_obj': None,
            'coefficients': []
        }

        # --- 2. EVOLUTIONARY TRAINING ---
        
        # PHASE 1: BABY MODE
        if data_points < 14:
            model_info['type'] = 'average'

        # PHASE 2: TEENAGER MODE (Linear Trend)
        elif data_points < 60:
            model_info['type'] = 'linear_trend'
            X = df[['day_index']]
            reg = LinearRegression()
            reg.fit(X, y)
            model_info['model_obj'] = reg
            model_info['slope'] = reg.coef_[0] 

        # PHASE 3: ADULT MODE (Seasonal)
        else:
            model_info['type'] = 'seasonal_trend'
            feature_cols = ['day_index'] + [f'dow_{d}' for d in range(7)]
            X = df[feature_cols]
            reg = LinearRegression()
            reg.fit(X, y)
            model_info['model_obj'] = reg
            model_info['slope'] = reg.coef_[0]

        model_registry[product.id] = model_info

        # --- 3. ANOMALY DETECTION ---
        _detect_anomalies(tenant, product, df, model_info)

    # --- 4. SAVE REGISTRY ---
    model_dir = _get_model_dir()
    model_path = os.path.join(model_dir, f"tenant_{tenant_id}_brain.pkl")
    
    with open(model_path, 'wb') as f:
        pickle.dump(model_registry, f)
        
    ForecastModel.objects.update_or_create(
        tenant=tenant,
        model_type='evolutionary_v1',
        defaults={'file_path': model_path, 'version': 2}
    )

def _detect_anomalies(tenant, product, df, model_info):
    # A. GHOST STOCK
    if product.quantity > 5:
        last_5_sum = df['adjusted_qty'].tail(5).sum()
        prior_avg = model_info['avg_sales']
        if prior_avg > 1.0 and last_5_sum == 0:
            InventoryAnomaly.objects.create(
                tenant=tenant, product=product, anomaly_type='shrinkage', severity='medium',
                description=f"Ghost Stock: 0 sales in 5 days. Normally sells {prior_avg:.1f}/day."
            )

    # B. VELOCITY SPIKE
    recent_max = df['adjusted_qty'].tail(3).max()
    threshold = model_info['avg_sales'] * 5
    if recent_max > threshold and recent_max > 10:
        InventoryAnomaly.objects.create(
            tenant=tenant, product=product, anomaly_type='velocity_spike', severity='low',
            description=f"Velocity Spike: Sold {recent_max} units (Normal max: ~{model_info['avg_sales'] * 2:.0f})."
        )

@shared_task(bind=True)
def generate_daily_forecasts(self, tenant_id):
    """
    Uses the EVOLUTIONARY model to predict the future.
    """
    tenant = Tenant.objects.get(id=tenant_id)
    
    try:
        model_rec = ForecastModel.objects.get(tenant=tenant, model_type='evolutionary_v1')
        with open(model_rec.file_path, 'rb') as f:
            model_registry = pickle.load(f)
    except ForecastModel.DoesNotExist:
        return "No brain found for this tenant."

    today = date.today()
    
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
                reason = "Based on average (New Item)"

            elif info['type'] == 'linear_trend':
                reg = info['model_obj']
                X_pred = pd.DataFrame({'day_index': [next_day_index]})
                predicted_qty = reg.predict(X_pred)[0]
                slope = info['slope']
                reason = "Trending Up 📈" if slope > 0.05 else "Trending Down 📉" if slope < -0.05 else "Stable Trend"

            elif info['type'] == 'seasonal_trend':
                reg = info['model_obj']
                dow = tomorrow.weekday()
                input_data = {'day_index': [next_day_index]}
                for d in range(7):
                    input_data[f'dow_{d}'] = [1 if d == dow else 0]
                
                X_pred = pd.DataFrame(input_data)
                predicted_qty = reg.predict(X_pred)[0]
                
                slope = info['slope']
                day_name = tomorrow.strftime("%A")
                reason = f"{day_name} Pattern"
                if slope > 0.05: reason += " + Growth"

            predicted_qty = max(0, round(predicted_qty, 1))

            Forecast.objects.update_or_create(
                tenant=tenant, product=product, prediction_date=tomorrow,
                defaults={'predicted_quantity': predicted_qty, 'reasoning': reason}
            )

            if info['avg_sales'] > 0:
                days_cover = product.quantity / info['avg_sales']
                if days_cover < 3:
                     InventoryAnomaly.objects.get_or_create(
                        tenant=tenant, product=product, anomaly_type='stockout_risk',
                        defaults={'severity': 'high', 'description': f"Critical Low Stock: Only {days_cover:.1f} days cover."}
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