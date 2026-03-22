import random
import uuid
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.db import transaction
from tenants.models import Tenant
from inventory.models import Product, Category, Supplier
from sales.models import Sale, SaleItem

User = get_user_model()

# --- 1. THE DIVERSE CATALOG (Expanded & Realistic) ---
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
    help = "Seeds 3 months of realistic, high-fidelity data."

    def handle(self, *args, **kwargs):
        tenant_id = 10
        self.stdout.write("🏗️  Building Pitch-Ready Dataset...")

        tenant = Tenant.objects.get(id=tenant_id)
        user = User.objects.filter(tenant=tenant).first()
        user_field = next((f.name for f in Sale._meta.fields if f.related_model == User), None)

        # 1. CLEANUP
        SaleItem.objects.filter(sale__tenant=tenant).delete()
        Sale.objects.filter(tenant=tenant).delete()
        Product.objects.filter(tenant=tenant).delete()

        # 2. CREATE PRODUCTS (High Initial Stock to handle 90 days of sales)
        all_products = []
        p_ghost, p_risk, p_spike = None, None, None

        for cat_name, items in RAW_CATALOG.items():
            category, _ = Category.objects.get_or_create(name=cat_name, tenant=tenant)
            for name, price in items:
                is_ghost = "Dangote Sugar" in name
                is_risk = "Milo" in name
                is_spike = "Orijin" in name

                # 🚀 FIX: Start with 1000 units so we don't hit 0 during the 90-day simulation
                qty = 1000 
                
                prod = Product.objects.create(
                    name=name, sku=f"SKU-{uuid.uuid4().hex[:6].upper()}",
                    price=price, quantity=qty, category=category, tenant=tenant
                )
                all_products.append(prod)
                
                if is_ghost: p_ghost = prod
                if is_risk: p_risk = prod
                if is_spike: p_spike = prod

        # 3. GENERATE HISTORY
        days_back = 90
        today = timezone.now().date()
        current_date = today - timedelta(days=days_back)

        while current_date < today:
            # (Keep the daily_customers logic the same...)
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
                    
                    # 🚀 FIX: Use timezone.make_aware to fix the "Naive Datetime" Warning
                    dt = timezone.make_aware(timezone.datetime.combine(current_date, timezone.datetime.min.time()))
                    Sale.objects.filter(id=sale.id).update(created_at=dt)

                    total = 0
                    for item in basket:
                        qty = random.randint(1, 3)
                        # 🚀 NOTE: Ensure your SaleItem signal is NOT subtracting stock during seeding
                        SaleItem.objects.create(
                            sale=sale, product=item, quantity=qty,
                            unit_price=item.price, subtotal=item.price * qty
                        )
                        total += (item.price * qty)
                    
                    Sale.objects.filter(id=sale.id).update(total_amount=total)

            current_date += timedelta(days=1)

        # 4. SURGERY (This is where we force the Presentation State)
        self.stdout.write("💉 Injecting Presentation Anomalies...")
        
        # A. Milo (Critical Risk): Set stock very low AFTER history is built
        if p_risk:
            Product.objects.filter(id=p_risk.id).update(quantity=5)

        # B. Dangote Sugar (Ghost Stock): Set stock high but it hasn't sold recently
        if p_ghost:
            Product.objects.filter(id=p_ghost.id).update(quantity=95)

        # C. Orijin (Velocity Spike): Inject the massive sale
        if p_spike:
            # Update Orijin stock so the 150 sale doesn't crash the DB
            Product.objects.filter(id=p_spike.id).update(quantity=500)
            
            yesterday = timezone.now() - timedelta(days=1)
            spike_sale = Sale.objects.create(
                tenant=tenant, total_amount=p_spike.price * 150,
                payment_method='transfer', **{user_field: user},
                reference=f"SPIKE-{uuid.uuid4().hex[:10].upper()}"
            )
            Sale.objects.filter(id=spike_sale.id).update(created_at=yesterday)
            SaleItem.objects.create(
                sale=spike_sale, product=p_spike, quantity=150,
                unit_price=p_spike.price, subtotal=p_spike.price * 150
            )

        self.stdout.write(self.style.SUCCESS("✨ SUCCESS: Presentation data is now perfect."))