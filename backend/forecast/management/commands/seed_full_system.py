import random
import uuid
from datetime import timedelta
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Sum
from tenants.models import Tenant
from inventory.models import Product, Category, Supplier
from sales.models import Sale, SaleItem

User = get_user_model()

# --- 1. THE MERGED CATALOG (100+ Items) ---
CATEGORY_MAP = {
    "Grains & Swallow": 3, "Breakfast & Beverages": 2, "Cooking Ingredients": 0,
    "Drinks & Alcohol": 1, "Toiletries & Hygiene": 4, "Baby & Kids": 4,
    "Snacks & Biscuits": 1, "Tech & Home": 5
}

RAW_CATALOG = {
    "Grains & Swallow": [
        ("Mama Gold Rice (5kg)", 9500), ("Royal Stallion Rice (1kg)", 2100),
        ("Honeywell Semovita (1kg)", 1800), ("Golden Penny Semovita (2kg)", 3500),
        ("Ola Ola Pounded Yam (1kg)", 2200), ("Garri Ijebu (Paint Bucket)", 3500),
        ("Garri Yellow (1kg Pack)", 1200), ("Mama Pride Parboiled Rice (10kg)", 18000), 
        ("Indomie Super Pack (Carton)", 8500), ("Spaghetti Golden Penny", 900)
    ],
    "Breakfast & Beverages": [
        ("Milo Refill Pack (900g)", 5800), ("Ovaltine Sachet", 200),
        ("Lipton Yellow Label Tea", 1200), ("Nescafé Classic (Tin)", 3200), 
        ("Golden Morn (900g)", 2500), ("Corn Flakes (Nasco)", 1800), 
        ("Custard Checkers (2kg)", 4800), ("Quaker Oats (Tin)", 3500)
    ],
    "Cooking Ingredients": [
        ("Knorr Maggi Cubes", 1100), ("Gino Tomato Paste (Sachet)", 150), 
        ("Sonia Tomato Paste (Tin)", 400), ("Mr Chef Curry Powder", 300), 
        ("Onga Stew Seasoning", 200), ("Ducros Thyme", 450), 
        ("Dangote Salt (1kg)", 500), ("Devon King's Veg Oil (1L)", 2800), 
        ("Mamador Oil (3L)", 8500), ("Palm Oil (Bottle 75cl)", 1500)
    ],
    "Drinks & Alcohol": [
        ("Coca Cola (50cl)", 300), ("Fanta (50cl)", 300), ("Schweppes Chapman", 500), 
        ("Monster Energy", 1200), ("Hollandia Yoghurt (1L)", 2200), 
        ("Chivita 100% Juice", 2000), ("5 Alive Pulpy", 1500), ("Star Lager Beer", 700), 
        ("Heineken", 900), ("Guinness Stout", 800), ("Smirnoff Ice", 800), 
        ("Hennessy VS", 45000), ("Eva Water", 200)
    ],
    "Toiletries & Hygiene": [
        ("Dettol Antiseptic", 1200), ("Hypo Bleach", 200), ("Sunlight Detergent", 1600), 
        ("WAW Detergent", 1500), ("Morning Fresh", 900), ("Canoe Soap", 500), 
        ("Lux Bath Soap", 600), ("Oral-B Toothpaste", 1200), ("Nivea Body Lotion", 3500), 
        ("Always Sanitary Pad", 1100)
    ],
    "Baby & Kids": [
        ("Pampers Diapers", 2500), ("Molfix Diapers", 8500), ("Johnson's Baby Oil", 2200), 
        ("Baby Wipes", 1500), ("Cerelac Wheat", 4500), ("NAN 1 Baby Food", 6500), 
        ("Ribena Drink", 400), ("Capri-Sun", 4500)
    ],
    "Snacks & Biscuits": [
        ("Gala Sausage Roll", 200), ("Plantain Chips", 250), ("Pure Bliss Cookies", 300), 
        ("Yale Bread", 1200), ("Butterfield Bread", 1400), ("McVities Digestives", 900), 
        ("Coaster Biscuit", 200), ("Mentos Gum", 500)
    ],
    "Tech & Home": [
        ("Duracell AA Batteries", 1500), ("Tiger Batteries", 400), ("Extension Box", 3500), 
        ("iPhone Cable", 3000), ("Android Type-C", 1500), ("Earpiece", 1000), 
        ("Rechargeable Torch", 2500), ("Matches Box", 100)
    ]
}

SUPPLIERS_DB = [
    {"name": "Dangote Industries", "email": "orders@dangote.ng", "phone": "08030001111"},
    {"name": "Chi Limited", "email": "sales@chilimited.com", "phone": "08022223333"},
    {"name": "Nestlé Nigeria", "email": "partners@nestle.ng", "phone": "01-2798181"},
    {"name": "Flour Mills (FMN)", "email": "info@fmnplc.com", "phone": "08055556666"},
    {"name": "PZ Cussons", "email": "distributors@pz.com", "phone": "08099998888"},
    {"name": "Local Market (Oyingbo)", "email": "market@local.ng", "phone": "07011223344"},
]

class Command(BaseCommand):
    help = "The 'Layered Reality' Engine: Healthy History + Forced Anomalies"

    def handle(self, *args, **kwargs):
        target_tenant_id = 34
        self.stdout.write("🏗️  Initializing Naija Hypermarket Simulation (Layered Mode)...")

        # --- A. SETUP ---
        try:
            tenant = Tenant.objects.get(id=target_tenant_id)
            user = User.objects.filter(tenant=tenant).first()
            if not user: raise Exception("No User found")
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"❌ Setup Error: {e}"))
            return

        # Introspection
        user_field = next((f.name for f in Sale._meta.fields if f.related_model == User), None)
        has_ref = any(f.name == 'reference' for f in Sale._meta.fields)
        has_cost = any(f.name == 'cost_price' for f in Product._meta.fields)
        has_sup = any(f.name == 'supplier' for f in Product._meta.fields)

        # --- B. CLEANUP ---
        self.stdout.write("🧹 Cleaning old data...")
        SaleItem.objects.filter(sale__tenant=tenant).delete()
        Sale.objects.filter(tenant=tenant).delete()
        Product.objects.filter(tenant=tenant).delete()
        Category.objects.filter(tenant=tenant).delete()
        Supplier.objects.filter(tenant=tenant).delete()

        # --- C. CREATE SUPPLIERS ---
        suppliers = []
        if has_sup:
            for s in SUPPLIERS_DB:
                suppliers.append(Supplier.objects.create(tenant=tenant, **s))

        # --- D. CREATE PRODUCTS (Healthy Stock First) ---
        self.stdout.write("📦 Stocking 100+ Products...")
        all_products = []
        
        # Track our Anomaly Candidates
        p_ghost = None  # Dangote Sugar
        p_spike = None  # Orijin
        p_risk = None   # Peak Milk

        for cat_name, items in RAW_CATALOG.items():
            category, _ = Category.objects.get_or_create(name=cat_name, tenant=tenant)
            sup_idx = CATEGORY_MAP.get(cat_name, 5)

            for name, price in items:
                # Identification
                is_ghost = "Dangote Sugar" in name
                is_spike = "Orijin" in name
                is_risk = "Peak Milk" in name and "Tin" in name

                final_name = name
                # Start EVERYONE with High Stock (We fix this later in the Surgery Step)
                qty = random.randint(3000, 6000) 

                if is_ghost:
                    final_name = "Dangote Sugar (Ghost Batch)"
                elif is_spike:
                    final_name = "Orijin Bitters (Viral)"
                elif is_risk:
                    final_name = "Peak Milk (Critical)"

                # Profit Margin Logic (Cost is 70-85% of Price)
                margin = random.uniform(0.15, 0.30)
                cost_price = int(price * (1 - margin))

                p_kwargs = {
                    'name': final_name, 'sku': f"SKU-{uuid.uuid4().hex[:6].upper()}",
                    'price': price, 'quantity': qty, 'category': category, 'tenant': tenant
                }
                if has_cost: p_kwargs['cost_price'] = cost_price
                if has_sup: p_kwargs['supplier'] = suppliers[sup_idx]

                prod = Product.objects.create(**p_kwargs)
                all_products.append(prod)

                if is_ghost: p_ghost = prod
                if is_spike: p_spike = prod
                if is_risk: p_risk = prod

        # --- E. THE TIME MACHINE (History Generation) ---
        # We generate a "Normal" healthy history first.
        days_back = 365
        end_date = timezone.now().date() # Use Date only for loop safety
        start_date = end_date - timedelta(days=days_back)
        current_date = start_date
        
        self.stdout.write(f"🚀 Simulating history ({start_date} to {end_date})...")

        # FIX 1: Use < instead of <= to prevent Infinite Loop on the last day
        while current_date < end_date:
            batch_end = min(current_date + timedelta(days=30), end_date)
            
            with transaction.atomic():
                while current_date < batch_end:
                    # Traffic Logic
                    daily_customers = random.randint(20, 45)
                    if current_date.weekday() >= 5: daily_customers += 15 # Weekend
                    if current_date.day >= 25: daily_customers += 10 # Payday

                    for _ in range(daily_customers):
                        basket = random.sample(all_products, k=random.randint(1, 5))
                        if not basket: continue

                        # Create Sale Header
                        s_kwargs = {
                            'tenant': tenant, 'total_amount': 0, # Placeholder
                            'payment_method': random.choice(['cash', 'pos']), user_field: user
                        }
                        # FIX 2: Always ensure Unique Reference
                        if has_ref: s_kwargs['reference'] = f"REF-{uuid.uuid4().hex[:12].upper()}"
                        
                        sale = Sale.objects.create(**s_kwargs)
                        # Backdate
                        dt = timezone.make_aware(timezone.datetime.combine(current_date, timezone.datetime.min.time())) + timedelta(hours=random.randint(9, 20))
                        Sale.objects.filter(id=sale.id).update(created_at=dt)

                        real_total = 0
                        for item in basket:
                            # WEIGHTED RANDOM QUANTITY
                            q_opts = [1, random.randint(2,3), 6, 12]
                            weights = [50, 30, 15, 5]
                            qty = random.choices(q_opts, weights=weights, k=1)[0]
                            
                            SaleItem.objects.create(
                                sale=sale, product=item, quantity=qty,
                                unit_price=item.price, subtotal=item.price * qty
                            )
                            real_total += (item.price * qty)
                        
                        # Update final total
                        Sale.objects.filter(id=sale.id).update(total_amount=real_total)

                    current_date += timedelta(days=1)
            
            self.stdout.write(f"   📅 History saved up to {batch_end}")

        # --- F. THE SURGERY (Forcing the Anomalies) ---
        # This happens AFTER the loop. We explicitly inject history to guarantee alerts.
        self.stdout.write("🩺 Performing Data Surgery (Injecting Anomalies)...")
        
        with transaction.atomic():
            yesterday = timezone.now() - timedelta(days=1)
            week_ago = timezone.now() - timedelta(days=7)

            # 1. GHOST STOCK SURGERY
            # Condition: High Stock + Good History (Avg > 1.0) + ZERO Sales in last 7 days
            if p_ghost:
                self.stdout.write("   👻 Creating Ghost Stock (Dangote Sugar)...")
                # A. Set High Stock (Bypass checks)
                Product.objects.filter(id=p_ghost.id).update(quantity=800)
                # B. NUKE sales from last 7 days
                SaleItem.objects.filter(product=p_ghost, sale__created_at__gte=week_ago).delete()
                # C. INJECT EXTRA HISTORY (To guarantee avg > 0.5)
                # Inject 60 sales over the last 2 months (skipping the last week)
                start_hist = yesterday - timedelta(days=67)
                for _ in range(60):
                    self._create_bulk(tenant, user, p_ghost, start_hist, 3, user_field, has_ref, is_viral=False)
                    start_hist += timedelta(days=1)


            # 2. STOCKOUT RISK SURGERY
            # Condition: High Velocity (Last 30 days) + Critical Current Stock
            if p_risk:
                self.stdout.write("   ⚠️  Creating Stockout Risk (Peak Milk)...")
                # A. Set Critical Stock
                Product.objects.filter(id=p_risk.id).update(quantity=12)
                # B. INJECT CONSISTENT SALES (Last 30 days) to prove velocity > 2/day
                curr = yesterday - timedelta(days=30)
                while curr < yesterday:
                    self._create_bulk(tenant, user, p_risk, curr, 3, user_field, has_ref, is_viral=False)
                    curr += timedelta(days=1)

            # 3. VELOCITY SPIKE SURGERY
            # Condition: Massive outlier sale YESTERDAY
            if p_spike:
                self.stdout.write("   🚀 Creating Velocity Spike (Orijin)...")
                # Inject one huge sale dated yesterday
                self._create_bulk(tenant, user, p_spike, yesterday, 250, user_field, has_ref, is_viral=True)

        self.stdout.write(self.style.SUCCESS("✨ FULL SYSTEM READY."))
        self.stdout.write(self.style.SUCCESS("✅ Layer 1: 2 Years of healthy sales."))
        self.stdout.write(self.style.SUCCESS("✅ Layer 2: 3 Anomalies guaranteed (Sugar, Milk, Orijin)."))

    def _create_bulk(self, tenant, user, prod, date_obj, qty, u_field, h_ref, is_viral=False):
        """Helper to safely inject specific sales"""
        kw = {
            'tenant': tenant, 
            'total_amount': prod.price * qty, 
            'payment_method': 'transfer' if is_viral else 'cash', 
            u_field: user
        }
        
        # FIX 3: Robust Unique Reference Generation
        if h_ref:
            prefix = "VIRAL" if is_viral else "REC"
            kw['reference'] = f"{prefix}-{uuid.uuid4().hex[:12].upper()}"

        s = Sale.objects.create(**kw)
        Sale.objects.filter(id=s.id).update(created_at=date_obj)
        
        SaleItem.objects.create(
            sale=s, product=prod, quantity=qty, 
            unit_price=prod.price, subtotal=prod.price * qty
        )