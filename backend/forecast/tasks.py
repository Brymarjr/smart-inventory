import os
import pickle
from datetime import date

from celery import shared_task
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from tenants.models import Tenant
from inventory.models import Product

from forecast.models import ForecastModel, Forecast
from forecast.utils import (
    generate_features_for_tenant,
    compute_reorder_quantity,
)


def _get_model_dir():
    """
    Ensure ML model storage directory exists.
    """
    base_dir = os.path.join(settings.BASE_DIR, 'forecast', 'ml_models')
    os.makedirs(base_dir, exist_ok=True)
    return base_dir


@shared_task(bind=True)
def train_model_for_tenant(self, tenant_id):
    """
    Train a baseline forecasting model for a specific tenant.
    Enforces exactly ONE model per tenant.
    """
    tenant = Tenant.objects.get(id=tenant_id)

    features = generate_features_for_tenant(tenant)
    model_data = {}

    for product_id, df in features.items():
        # Baseline: average of last 30 days of sales
        recent_sales = df['quantity_sold'].tail(30)
        model_data[product_id] = float(recent_sales.mean())

    model_dir = _get_model_dir()
    model_path = os.path.join(model_dir, f"tenant_{tenant_id}_baseline.pkl")

    with open(model_path, 'wb') as f:
        pickle.dump(model_data, f)

    # HARD ENFORCEMENT: delete old baseline models
    ForecastModel.objects.filter(tenant=tenant, model_type='baseline').delete()

    # Create new model record
    ForecastModel.objects.create(
        tenant=tenant,
        model_type='baseline',
        file_path=model_path,
        version=1,  # always 1 since old models deleted
        accuracy_score=None,
        trained_at=timezone.now(),
    )

    return {
        "tenant_id": tenant_id,
        "model_type": "baseline",
        "status": "trained",
    }


@shared_task(bind=True)
def generate_forecast_for_tenant(self, tenant_id):
    """
    Generate demand forecasts using the latest trained model.
    """
    tenant = Tenant.objects.get(id=tenant_id)

    model_record = (
        ForecastModel.objects.filter(tenant=tenant)
        .order_by('-version')
        .first()
    )

    if not model_record:
        raise ValueError(f"No trained model found for tenant {tenant.id}")

    with open(model_record.file_path, 'rb') as f:
        model_data = pickle.load(f)

    today = date.today()

    with transaction.atomic():
        for product in Product.objects.filter(tenant=tenant):
            predicted_qty = int(model_data.get(product.id, 0))

            # ✅ SAFELY compute reorder quantity without referencing current_stock
            reorder_qty = compute_reorder_quantity(predicted_qty)

            # Create or update forecast
            Forecast.objects.update_or_create(
                tenant=tenant,
                product=product,
                prediction_date=today,
                defaults={
                    "predicted_quantity": predicted_qty,
                    "confidence_interval": {
                        "min": max(predicted_qty - 5, 0),
                        "max": predicted_qty + 5,
                    },
                }
            )

    return {
        "tenant_id": tenant_id,
        "date": str(today),
        "status": "forecast_generated",
    }


@shared_task
def train_models_for_all_tenants(sync=False):
    """
    Train baseline models for all tenants.
    Uses sync=True for immediate execution (blocking), else async with Celery.
    """
    for tenant in Tenant.objects.all():
        if sync:
            train_model_for_tenant(tenant.id)
        else:
            train_model_for_tenant.delay(tenant.id)


@shared_task
def generate_forecasts_for_all_tenants(sync=False):
    """
    Generate forecasts for all tenants using latest models.
    """
    for tenant in Tenant.objects.all():
        if sync:
            generate_forecast_for_tenant(tenant.id)
        else:
            generate_forecast_for_tenant.delay(tenant.id)
