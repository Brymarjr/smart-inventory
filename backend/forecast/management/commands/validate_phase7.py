from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from tenants.models import Tenant
from inventory.models import Product
from sales.models import Sale
from purchases.models import PurchaseOrder

from forecast.models import Forecast, ForecastModel
from forecast.tasks import (
    train_model_for_tenant,
    generate_forecast_for_tenant,
    train_models_for_all_tenants,
    generate_forecasts_for_all_tenants,
)

class Command(BaseCommand):
    help = "Validate Phase 7 (Forecasting / ML) end-to-end"

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS("🚀 Phase 7 Validation Started"))

        self._validate_preconditions()
        self._test_single_tenant_flow()
        self._test_all_tenants_flow()
        self._test_idempotency()

        self.stdout.write(self.style.SUCCESS("✅ Phase 7 Validation Completed Successfully"))

    # --------------------------------------------------
    # Preconditions
    # --------------------------------------------------
    def _validate_preconditions(self):
        self.stdout.write("🔍 Checking data preconditions...")

        tenants = Tenant.objects.all()
        assert tenants.exists(), "No tenants found"

        for tenant in tenants:
            assert Product.objects.filter(tenant=tenant).exists(), f"No products for tenant {tenant.id}"
            assert Sale.objects.filter(tenant=tenant).exists(), f"No sales for tenant {tenant.id}"
            assert PurchaseOrder.objects.filter(tenant=tenant).exists(), f"No purchases for tenant {tenant.id}"

        self.stdout.write(self.style.SUCCESS("✔ Preconditions satisfied"))

    # --------------------------------------------------
    # Single Tenant Flow
    # --------------------------------------------------
    def _test_single_tenant_flow(self):
        tenant = Tenant.objects.first()
        self.stdout.write(f"🧠 Testing single-tenant ML flow (Tenant {tenant.id})")

        # Train model
        train_model_for_tenant(tenant.id)

        model = (
            ForecastModel.objects
            .filter(tenant=tenant)
            .order_by("-trained_at")
            .first()
        )

        assert model is not None, "No trained model found for tenant"
        assert model.trained_at is not None, "Model not marked as trained"

        # Generate forecast
        generate_forecast_for_tenant(tenant.id)

        forecasts = Forecast.objects.filter(tenant=tenant)
        assert forecasts.exists(), "No forecasts generated"

        # Validate forecast integrity
        seen = set()
        for f in forecasts:
            key = (f.product_id, f.prediction_date)
            assert key not in seen, f"Duplicate forecast detected: {key}"
            seen.add(key)

            assert f.predicted_quantity >= 0, "Negative forecast quantity detected"

        self.stdout.write(self.style.SUCCESS("✔ Single-tenant flow OK"))

    # --------------------------------------------------
    # All Tenants Flow
    # --------------------------------------------------
    def _test_all_tenants_flow(self):
        self.stdout.write("🌍 Testing all-tenants ML flow")

        train_models_for_all_tenants(sync=True)
        generate_forecasts_for_all_tenants(sync=True)

        for tenant in Tenant.objects.all():
            model = (
                ForecastModel.objects
                .filter(tenant=tenant)
                .order_by("-trained_at")
                .first()
            )
            assert model is not None, f"No trained model found for tenant {tenant.id}"

            forecast_count = Forecast.objects.filter(tenant=tenant).count()
            assert forecast_count > 0, f"No forecasts for tenant {tenant.id}"

        self.stdout.write(self.style.SUCCESS("✔ All-tenants flow OK"))


    # --------------------------------------------------
    # Idempotency
    # --------------------------------------------------
    def _test_idempotency(self):
        self.stdout.write("🔁 Testing idempotency")

        before = Forecast.objects.count()
        generate_forecasts_for_all_tenants()
        after = Forecast.objects.count()

        assert before == after, "Forecast generation is NOT idempotent"

        self.stdout.write(self.style.SUCCESS("✔ Idempotency verified"))
