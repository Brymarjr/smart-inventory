from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from forecast.tasks import train_and_detect_anomalies, generate_daily_forecasts
from forecast.models import InventoryAnomaly, Forecast
from inventory.models import Product

User = get_user_model()

class Command(BaseCommand):
    help = "Runs AI Engine and verifies it detected the seeded scenarios"

    def handle(self, *args, **kwargs):
        self.stdout.write("🧠 Running AI Engine (Training & Detection)...")
        
        # We look for the manager created by the Reality Engine
        user = User.objects.filter(email="manager@simulation.com").first()
        if not user:
             self.stdout.write(self.style.ERROR("❌ Simulation User not found. Did you run 'seed_reality_engine'?"))
             return

        tenant = user.tenant

        # 1. Run the Tasks Synchronously
        train_and_detect_anomalies(tenant.id)
        generate_daily_forecasts(tenant.id)

        self.stdout.write("📊 Verifying Results...\n")

        # ==========================================
        # TEST 1: Check "The Ghost Stock" (Shrinkage)
        # ==========================================
        # This product stopped selling 10 days ago but has stock.
        try:
            p_ghost = Product.objects.get(sku='SIM-GHOST', tenant=tenant)
            anomaly = InventoryAnomaly.objects.filter(
                product=p_ghost, 
                anomaly_type='shrinkage',
                is_resolved=False
            ).first()

            if anomaly:
                self.stdout.write(self.style.SUCCESS(f"✅ PASSED: Detected 'Ghost Stock' (Shrinkage)."))
            else:
                self.stdout.write(self.style.ERROR(f"❌ FAILED: Did not detect Shrinkage for {p_ghost.name}."))
        except Product.DoesNotExist:
            self.stdout.write(self.style.ERROR("❌ FAILED: Product SIM-GHOST not found."))

        # ==========================================
        # TEST 2: Check "The Spike" (Velocity)
        # ==========================================
        # This product sold 200 units yesterday (normal is 2).
        try:
            p_spike = Product.objects.get(sku='SIM-SPIKY', tenant=tenant)
            anomaly = InventoryAnomaly.objects.filter(
                product=p_spike, 
                anomaly_type='velocity_spike'
            ).first()

            if anomaly:
                self.stdout.write(self.style.SUCCESS(f"✅ PASSED: Detected 'Velocity Spike'."))
            else:
                self.stdout.write(self.style.ERROR(f"❌ FAILED: Did not detect Spike for {p_spike.name}."))
        except Product.DoesNotExist:
            self.stdout.write(self.style.ERROR("❌ FAILED: Product SIM-SPIKY not found."))

        # ==========================================
        # TEST 3: Check "The Rising Star" (Forecasting)
        # ==========================================
        # This product grew from 1/day to 20/day over a year.
        try:
            p_trend = Product.objects.get(sku='SIM-TREND', tenant=tenant)
            forecast = Forecast.objects.filter(product=p_trend).first()
            
            if forecast:
                # Expectation: Predicted quantity should be high (~20+) and reasoning should mention trend
                if forecast.predicted_quantity > 18 and "Trending Up" in (forecast.reasoning or ""):
                    self.stdout.write(self.style.SUCCESS(f"✅ PASSED: Recognized upward trend ({forecast.predicted_quantity} units). Reasoning: {forecast.reasoning}"))
                else:
                    self.stdout.write(self.style.WARNING(f"⚠️ WARNING: Weak Forecast. Qty: {forecast.predicted_quantity}, Reason: {forecast.reasoning}"))
            else:
                self.stdout.write(self.style.ERROR(f"❌ FAILED: No forecast generated for {p_trend.name}."))
        except Product.DoesNotExist:
            self.stdout.write(self.style.ERROR("❌ FAILED: Product SIM-TREND not found."))