import random
import uuid
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.contrib.auth import get_user_model
from tenants.models import Tenant
from inventory.models import Product, Category
from sales.models import Sale, SaleItem

User = get_user_model()

class Command(BaseCommand):
    help = "Injects AI Simulation Data into Tenant ID 6 (Safe Mode)"

    def handle(self, *args, **kwargs):
        target_tenant_id = 6  # <--- TARGETING YOUR SPECIFIC TENANT

        self.stdout.write(f"🏗️  Initializing Reality Engine for Tenant {target_tenant_id}...")

        # --- 1. GET TENANT ---
        try:
            tenant = Tenant.objects.get(id=target_tenant_id)
            self.stdout.write(f"✅ Found Tenant: {tenant.name} (ID: {tenant.id})")
        except Tenant.DoesNotExist:
            self.stdout.write(self.style.ERROR(f"❌ Tenant with ID {target_tenant_id} not found!"))
            return

        # --- 2. GET EXISTING USER ---
        # We need a user who already exists in this tenant to record the sales
        cashier = User.objects.filter(tenant=tenant).first()
        if not cashier:
            self.stdout.write(self.style.ERROR("❌ No users found in this tenant. Please create a user first."))
            return
        self.stdout.write(f"👤 Recording simulated sales as: {cashier.username}")

        # --- 3. INTROSPECT SALE MODEL ---
        # (Find the correct field name for 'user' and check for 'reference')
        user_field_name = None
        has_reference_field = False
        
        for field in Sale._meta.fields:
            if field.related_model == User:
                user_field_name = field.name
            if field.name == 'reference':
                has_reference_field = True
        
        if not user_field_name:
            self.stdout.write(self.style.ERROR("❌ Could not find User ForeignKey in Sale model."))
            return

        # --- 4. SAFE CLEANUP ---
        # Only remove previous SIMULATION items to keep your real data safe
        self.stdout.write("🧹 Cleaning up old SIMULATION data (keeping real data safe)...")
        Product.objects.filter(tenant=tenant, sku__startswith="SIM-").delete()

        # --- 5. CREATE PRODUCTS ---
        cat, _ = Category.objects.get_or_create(name="AI Simulation", tenant=tenant)
        
        # A. STABLE
        p_stable = Product.objects.create(
            name="Stable Batteries (AI)", sku="SIM-STABLE", 
            price=10, quantity=500, category=cat, tenant=tenant
        )
        # B. TRENDING
        p_trend = Product.objects.create(
            name="Trending Smartwatch (AI)", sku="SIM-TREND", 
            price=200, quantity=100, category=cat, tenant=tenant
        )
        # C. GHOST
        p_ghost = Product.objects.create(
            name="Ghost Phone (AI)", sku="SIM-GHOST", 
            price=900, quantity=50, category=cat, tenant=tenant
        )
        # D. SPIKY
        p_spiky = Product.objects.create(
            name="Spiky Cables (AI)", sku="SIM-SPIKY", 
            price=5, quantity=1000, category=cat, tenant=tenant
        )

        # --- 6. GENERATE HISTORY ---
        self.stdout.write("⏳ Generating 365 days of sales history...")
        
        sales_to_create = []
        end_date = timezone.now()
        start_date = end_date - timedelta(days=365)
        current_date = start_date

        while current_date <= end_date:
            days_passed = (current_date - start_date).days

            # A. STABLE (Constant ~10/day)
            qty_a = random.randint(8, 12)
            self._buffer_sale(sales_to_create, tenant, cashier, p_stable, current_date, qty_a, user_field_name, has_reference_field)

            # B. TRENDING (Linear Growth)
            growth = 1 + (days_passed * 0.05)
            qty_b = int(growth) + random.randint(0, 2)
            self._buffer_sale(sales_to_create, tenant, cashier, p_trend, current_date, qty_b, user_field_name, has_reference_field)

            # C. GHOST (Stop selling 10 days ago)
            if days_passed < 355:
                qty_c = 5
                self._buffer_sale(sales_to_create, tenant, cashier, p_ghost, current_date, qty_c, user_field_name, has_reference_field)

            # D. SPIKY (Massive spike yesterday)
            if days_passed == 364:
                qty_d = 200
            else:
                qty_d = random.randint(1, 3)
            self._buffer_sale(sales_to_create, tenant, cashier, p_spiky, current_date, qty_d, user_field_name, has_reference_field)

            current_date += timedelta(days=1)

        # --- 7. SAVE TO DB ---
        self.stdout.write(f"💾 Saving {len(sales_to_create)} simulated sales records...")
        
        for entry in sales_to_create:
            sale = Sale.objects.create(**entry['sale_data'])
            
            item_data = entry['item_data']
            item_data['sale'] = sale
            SaleItem.objects.create(**item_data)
            
            # Force backdate
            Sale.objects.filter(id=sale.id).update(created_at=entry['date'])

        self.stdout.write(self.style.SUCCESS(f"✅ Successfully injected AI data into Tenant {tenant.name} (ID: 6)!"))

    def _buffer_sale(self, sales_list, tenant, user, product, date, qty, user_field, has_ref):
        if qty <= 0: return
        
        payload = {
            'tenant': tenant,
            'total_amount': product.price * qty,
            'payment_method': 'cash',
        }
        payload[user_field] = user
        
        if has_ref:
            payload['reference'] = f"SIM-{uuid.uuid4().hex[:12].upper()}"

        sales_list.append({
            'sale_data': payload,
            'item_data': {
                'product': product,
                'quantity': qty,
                'unit_price': product.price,
                'subtotal': product.price * qty
            },
            'date': date
        })