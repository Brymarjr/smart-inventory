import random
import uuid
import numpy as np
import pandas as pd
from datetime import timedelta, date
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.contrib.auth import get_user_model
from tenants.models import Tenant
from inventory.models import Product, Category
from sales.models import Sale, SaleItem
from forecast.tasks import train_and_detect_anomalies, generate_daily_forecasts
from forecast.models import Forecast

User = get_user_model()

class Command(BaseCommand):
    help = "Generates 90 days of 'Friday-Heavy' data to test the Seasonality Engine."

    def handle(self, *args, **kwargs):
        # 1. SETUP
        tenant_id = 6 # Target Busa
        try:
            tenant = Tenant.objects.get(id=tenant_id)
        except Tenant.DoesNotExist:
            self.stdout.write(self.style.ERROR(f"❌ Tenant 6 not found."))
            return

        cashier = User.objects.filter(tenant=tenant).first()
        if not cashier:
            self.stdout.write(self.style.ERROR("❌ No user found for Tenant 6."))
            return

        # --- SMART FIELD DETECTION ---
        user_field_name = None
        for field in Sale._meta.fields:
            if field.related_model == User:
                user_field_name = field.name
                break
        
        if not user_field_name:
            self.stdout.write(self.style.ERROR("❌ Could not find a User ForeignKey in Sale model."))
            return
            
        has_reference = any(f.name == 'reference' for f in Sale._meta.fields)
        
        self.stdout.write(f"🔍 Detected User field: '{user_field_name}' | Has Reference: {has_reference}")
        # -----------------------------

        cat, _ = Category.objects.get_or_create(name="Test Category", tenant=tenant)

        # 2. CREATE PRODUCT (SAFE DELETE)
        self.stdout.write("🍺 Creating 'Friday Party Pack'...")
        
        # ✅ FIX: Delete old SaleItems first to avoid ProtectedError
        old_products = Product.objects.filter(sku="TEST-SEASONAL")
        for p in old_products:
            # Delete the history linked to this product
            SaleItem.objects.filter(product=p).delete()
            p.delete()
        
        product = Product.objects.create(
            name="Friday Party Pack", 
            sku="TEST-SEASONAL",
            price=20.00, 
            quantity=500, 
            category=cat, 
            tenant=tenant
        )

        # 3. GENERATE 90 DAYS OF BIASED HISTORY
        self.stdout.write("📅 Injecting 90 days of history (Fridays = HIGH SALES)...")
        
        today = date.today()
        items_batch = []
        
        for i in range(90, 0, -1):
            d = today - timedelta(days=i)
            
            # THE LOGIC: If Friday (weekday 4), Sell 50. Else Sell 5.
            if d.weekday() == 4: 
                base_qty = 50
            else:
                base_qty = 5
            
            qty = max(1, base_qty + random.randint(-2, 2))
            
            # PREPARE DATA DYNAMICALLY
            sale_data = {
                'tenant': tenant,
                'total_amount': qty * 20,
                'payment_method': 'cash',
                user_field_name: cashier
            }
            
            if has_reference:
                sale_data['reference'] = f"TEST-{uuid.uuid4().hex[:10].upper()}"

            sale = Sale.objects.create(**sale_data)
            
            # Force Backdate
            Sale.objects.filter(id=sale.id).update(created_at=d)
            
            items_batch.append(SaleItem(
                sale=sale, product=product, quantity=qty,
                unit_price=20, subtotal=qty*20
            ))

        SaleItem.objects.bulk_create(items_batch)
        self.stdout.write("✅ History Injected.")

        # 4. RUN THE BRAIN
        self.stdout.write("🧠 Training Evolutionary AI (Adult Mode)...")
        train_and_detect_anomalies(tenant_id)
        generate_daily_forecasts(tenant_id)

        # 5. VERIFY RESULTS
        self.stdout.write("\n🔍 --- VERIFICATION RESULTS ---")
        
        forecast = Forecast.objects.filter(tenant=tenant, product=product).first()
        
        if forecast:
            pred_date = forecast.prediction_date
            is_friday = pred_date.weekday() == 4
            day_name = pred_date.strftime("%A")
            
            qty = forecast.predicted_quantity
            reason = forecast.reasoning
            
            self.stdout.write(f"📅 Prediction for: {day_name} ({pred_date})")
            self.stdout.write(f"📊 Predicted Qty: {qty}")
            self.stdout.write(f"🤖 AI Reasoning:  '{reason}'")
            
            # CHECK PASS/FAIL
            if is_friday:
                if qty > 40:
                    self.stdout.write(self.style.SUCCESS("✅ SUCCESS: AI predicted High Sales for Friday!"))
                else:
                    self.stdout.write(self.style.ERROR(f"❌ FAILURE: Friday Prediction too low ({qty}). Seasonality failed."))
            else:
                if qty < 15:
                    self.stdout.write(self.style.SUCCESS(f"✅ SUCCESS: AI predicted Normal Sales for {day_name}."))
                else:
                    self.stdout.write(self.style.ERROR(f"❌ FAILURE: {day_name} Prediction too high ({qty})."))
            
            if "Pattern" in reason:
                 self.stdout.write(self.style.SUCCESS("✅ SUCCESS: Reasoning detected 'Pattern'."))
            else:
                 self.stdout.write(self.style.WARNING("⚠️  Reasoning didn't mention 'Pattern'."))

        else:
             self.stdout.write(self.style.ERROR("❌ No forecast generated."))