import random
import uuid
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.db import transaction
from tenants.models import Tenant
from inventory.models import Product, Category, Supplier, SupplierPrice
from sales.models import Sale, SaleItem

User = get_user_model()

# --- 1. THE FULL CATALOG (ZERO REMOVALS) ---
RAW_CATALOG = {
    "Grains & Swallow": [
        ("Mama Gold Rice (5kg)", 9500), ("Royal Stallion Rice (1kg)", 2100),
        ("Honeywell Semovita (1kg)", 1800), ("Golden Penny Semovita (2kg)", 3500),
        ("Ola Ola Pounded Yam (1kg)", 2200), ("Garri Ijebu (Paint Bucket)", 3500),
        ("Indomie Super Pack (Carton)", 8500), ("Spaghetti Golden Penny", 900)
    ],
    "Breakfast & Beverages": [
        ("Milo Refill Pack (900g)", 5800), ("Ovaltine Sachet", 200),
        ("Lipton Yellow Label Tea", 1200), ("Nescafé Classic (Tin)", 3200), 
        ("Golden Morn (900g)", 2500), ("Quaker Oats (Tin)", 3500),
        ("Peak Milk (Full Cream Tin)", 1200), ("Three Crowns Milk", 1100)
    ],
    "Cooking Ingredients": [
        ("Knorr Maggi Cubes", 1100), ("Gino Tomato Paste (Sachet)", 150), 
        ("Dangote Sugar (500g)", 800), ("Mr Chef Curry Powder", 300), 
        ("Dangote Salt (1kg)", 500), ("Devon King's Veg Oil (1L)", 2800), 
        ("Mamador Oil (3L)", 8500), ("Palm Oil (75cl)", 1500)
    ],
    "Drinks & Alcohol": [
        ("Coca Cola (50cl)", 300), ("Fanta (50cl)", 300), ("Monster Energy", 1200), 
        ("Hollandia Yoghurt (1L)", 2200), ("Chivita 100% Juice", 2000), 
        ("Orijin Bitters (60cl)", 1500), ("Star Lager Beer", 700), 
        ("Heineken", 900), ("Guinness Stout", 800), ("Eva Water", 200)
    ],
    "Toiletries & Hygiene": [
        ("Dettol Antiseptic", 1200), ("Hypo Bleach", 200), ("Sunlight Detergent", 1600), 
        ("WAW Detergent", 1500), ("Morning Fresh", 900), ("Canoe Soap", 500), 
        ("Oral-B Toothpaste", 1200), ("Always Sanitary Pad", 1100)
    ],
    "Baby & Kids": [
        ("Pampers Diapers", 2500), ("Molfix Diapers", 8500), ("Johnson's Baby Oil", 2200), 
        ("Cerelac Wheat", 4500), ("NAN 1 Baby Food", 6500), ("Capri-Sun", 150)
    ],
}

SUPPLIERS_DB = [
    {"name": "Dangote Industries", "email": "orders@dangote.ng", "phone": "08030001111"},
    {"name": "Chi Limited", "email": "sales@chilimited.com", "phone": "08022223333"},
    {"name": "Nestlé Nigeria", "email": "partners@nestle.ng", "phone": "01-2798181"},
    {"name": "Flour Mills (FMN)", "email": "info@fmnplc.com", "phone": "08055556666"},
    {"name": "PZ Cussons", "email": "distributors@pz.com", "phone": "08099998888"},
]

class Command(BaseCommand):
    help = "Seeds 90 days of high-fidelity data with multiple presentation anomalies."

    def handle(self, *args, **kwargs):
        tenant_id = 1
        tenant = Tenant.objects.get(id=tenant_id)

        # PREVENT DUPLICATES: Check if data already exists for this tenant
        if Product.objects.filter(tenant=tenant).exists():
            self.stdout.write(self.style.SUCCESS(f"⏭️  Tenant {tenant_id} already has data. Skipping seeding to prevent duplicates."))
            return

        self.stdout.write(f"🏗️  Populating Tenant {tenant_id}...")

        user = User.objects.filter(tenant=tenant).first()
        user_field = next((f.name for f in Sale._meta.fields if f.related_model == User), None)

        # 1. CLEANUP
        with transaction.atomic():
            SaleItem.objects.filter(sale__tenant=tenant).delete()
            Sale.objects.filter(tenant=tenant).delete()
            SupplierPrice.objects.filter(tenant=tenant).delete()
            Product.objects.filter(tenant=tenant).delete()
            Supplier.objects.filter(tenant=tenant).delete()

        # 2. SEED SUPPLIERS
        created_suppliers = []
        for s_data in SUPPLIERS_DB:
            s = Supplier.objects.create(tenant=tenant, **s_data)
            created_suppliers.append(s)

        # 3. CREATE PRODUCTS & SUPPLIER LINKS
        all_products = []
        
        # Lists for Anomaly Targets
        ghost_targets = ["Dangote Sugar", "Canoe Soap", "Always Sanitary Pad"]
        risk_targets = ["Milo", "Indomie", "Peak Milk", "Pampers"]
        spike_targets = ["Orijin Bitters", "Monster Energy", "Heineken"]

        for cat_name, items in RAW_CATALOG.items():
            category, _ = Category.objects.get_or_create(name=cat_name, tenant=tenant)
            for name, price in items:
                # Map Supplier by Brand
                if "Dangote" in name: supplier = created_suppliers[0]
                elif any(x in name for x in ["Chivita", "Hollandia"]): supplier = created_suppliers[1]
                elif any(x in name for x in ["Nestlé", "Milo", "NAN"]): supplier = created_suppliers[2]
                elif any(x in name for x in ["Golden Penny", "Mama Gold", "Indomie"]): supplier = created_suppliers[3]
                else: supplier = created_suppliers[4]

                prod = Product.objects.create(
                    name=name, 
                    sku=f"SKU-{uuid.uuid4().hex[:6].upper()}",
                    price=price, 
                    cost_price=price * 0.75, 
                    quantity=2000, # Start high for simulation
                    category=category, 
                    tenant=tenant
                )
                
                SupplierPrice.objects.create(
                    tenant=tenant, 
                    product=prod, 
                    supplier=supplier,
                    supply_price=prod.cost_price, 
                    last_updated=timezone.now() - timedelta(days=20)
                )
                all_products.append(prod)

        # 4. GENERATE 90 DAYS OF SALES
        days_back = 90
        today = timezone.now().date()
        current_date = today - timedelta(days=days_back)

        self.stdout.write("📈 Simulating 3 months of transactions...")
        while current_date < today:
            customer_count = random.randint(15, 30)
            with transaction.atomic():
                for _ in range(customer_count):
                    basket = random.sample(all_products, k=random.randint(1, 4))
                    sale = Sale.objects.create(
                        tenant=tenant, total_amount=0,
                        payment_method=random.choice(['cash', 'pos']),
                        **{user_field: user},
                        reference=f"TXN-{uuid.uuid4().hex[:10].upper()}"
                    )
                    
                    dt = timezone.make_aware(timezone.datetime.combine(current_date, timezone.datetime.min.time()))
                    Sale.objects.filter(id=sale.id).update(created_at=dt)

                    total = 0
                    for item in basket:
                        # Ghost Stock Logic: Cut sales for targets in last 14 days
                        is_ghost_item = any(target in item.name for target in ghost_targets)
                        if is_ghost_item and (today - current_date).days < 14:
                            continue

                        qty = random.randint(1, 3)
                        SaleItem.objects.create(
                            sale=sale, product=item, quantity=qty,
                            unit_price=item.price, subtotal=item.price * qty
                        )
                        total += (item.price * qty)
                    
                    Sale.objects.filter(id=sale.id).update(total_amount=total)

            current_date += timedelta(days=1)

        # 5. GLOBAL NORMALIZATION & ANOMALIES
        self.stdout.write("💉 Normalizing shelf levels and finalizing anomalies...")
        
        for prod in all_products:
            is_risk_item = any(target in prod.name for target in risk_targets)
            is_spike_item = any(target in prod.name for target in spike_targets)
            
            if is_risk_item:
                # High velocity history, but set stock to critical level
                new_qty = random.randint(2, 6)
            elif is_spike_item:
                # Set normal stock, then inject a massive recent spike sale
                new_qty = random.randint(150, 200)
                yesterday = timezone.now() - timedelta(days=1)
                spike_qty = random.randint(70, 110)
                
                s = Sale.objects.create(
                    tenant=tenant, total_amount=prod.price * spike_qty,
                    payment_method='transfer', **{user_field: user},
                    reference=f"SPIKE-{uuid.uuid4().hex[:8].upper()}"
                )
                Sale.objects.filter(id=s.id).update(created_at=yesterday)
                SaleItem.objects.create(
                    sale=s, product=prod, quantity=spike_qty,
                    unit_price=prod.price, subtotal=prod.price * spike_qty
                )
            else:
                # Standard realistic shelf levels
                new_qty = random.randint(15, 40)

            Product.objects.filter(id=prod.id).update(quantity=new_qty)

        self.stdout.write(self.style.SUCCESS("✨ SUCCESS: Production environment populated."))