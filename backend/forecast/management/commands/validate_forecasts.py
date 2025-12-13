# forecast/management/commands/validate_forecasts.py

from django.core.management.base import BaseCommand
from tenants.models import Tenant
from inventory.models import Product
from forecast.models import Forecast, ForecastModel

class Command(BaseCommand):
    help = "Validate that forecasts exist and are consistent for all tenants and products"

    def handle(self, *args, **kwargs):
        self.stdout.write("🚀 Phase 7 Forecast Validation Started")

        tenants = Tenant.objects.all()
        if not tenants.exists():
            self.stdout.write(self.style.ERROR("No tenants found"))
            return

        for tenant in tenants:
            self.stdout.write(f"🔍 Checking Tenant {tenant.id} ({tenant.name})")

            products = Product.objects.filter(tenant=tenant)
            if not products.exists():
                self.stdout.write(self.style.WARNING(f"No products found for Tenant {tenant.id}"))
                continue

            # Check trained model
            model = ForecastModel.objects.filter(tenant=tenant).order_by("-trained_at").first()
            if not model:
                self.stdout.write(self.style.ERROR(f"No trained model found for Tenant {tenant.id}"))
            else:
                self.stdout.write(self.style.SUCCESS(f"✔ Model exists (version {model.version})"))

            missing_forecasts = []
            zero_forecasts = []

            for product in products:
                forecast = Forecast.objects.filter(tenant=tenant, product=product).first()
                if not forecast:
                    missing_forecasts.append(product.name)
                elif forecast.predicted_quantity == 0:
                    zero_forecasts.append(product.name)

            if missing_forecasts:
                self.stdout.write(self.style.ERROR(f"Missing forecasts for products: {missing_forecasts}"))
            else:
                self.stdout.write(self.style.SUCCESS("✔ All products have forecasts"))

            if zero_forecasts:
                self.stdout.write(self.style.WARNING(f"Products with 0 predicted quantity: {zero_forecasts}"))

        self.stdout.write(self.style.SUCCESS("✅ Phase 7 Forecast Validation Completed"))
