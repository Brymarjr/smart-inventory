import random
import uuid
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.db import transaction
from tenants.models import Tenant
from inventory.models import Product, Category
from sales.models import Sale, SaleItem

User = get_user_model()

# --- 🇳🇬 SAME NIGERIAN CATALOG (No Changes Here) ---
MARKET_CATALOG = {
    "Grains, Swallow & Staples": [
        ("Mama Gold Rice (5kg)", 9500), ("Royal Stallion Rice (1kg)", 2100),
        ("Honeywell Semovita (1kg)", 1800), ("Golden Penny Semovita (2kg)", 3500),
        ("Ola Ola Pounded Yam (1kg)", 2200), ("Garri Ijebu (Paint Bucket)", 3500),
        ("Garri Yellow (1kg Pack)", 1200), ("Dangote Sugar (1kg)", 2800),
        ("Mama Pride Parboiled Rice (10kg)", 18000), ("Indomie Super Pack (Carton)", 8500),
        ("Spaghetti Golden Penny (Pack)", 900), ("Power Pasta", 850)
    ],
    "Breakfast & Beverages": [
        ("Peak Milk Powder (Tin 900g)", 6500), ("Peak Milk Sachet (Roll)", 800),
        ("Milo Refill Pack (900g)", 5800), ("Ovaltine Sachet", 200),
        ("Lipton Yellow Label Tea (Pack)", 1200), ("Top Tea (Pack)", 900),
        ("Nescafé Classic (Tin)", 3200), ("Golden Morn (900g)", 2500),
        ("Corn Flakes (Nasco)", 1800), ("Custard Checkers (2kg)", 4800),
        ("Quaker Oats (Tin)", 3500)
    ],
    "Cooking Ingredients & Spices": [
        ("Knorr Maggi Cubes (Pack)", 1100), ("Maggi Star (Pack)", 1000),
        ("Gino Tomato Paste (Sachet)", 150), ("Sonia Tomato Paste (Tin)", 400),
        ("Mr Chef Curry Powder", 300), ("Onga Stew Seasoning", 200),
        ("Ducros Thyme", 450), ("Dangote Salt (1kg)", 500),
        ("Devon King's Vegetable Oil (1L)", 2800), ("Mamador Oil (3L)", 8500),
        ("Palm Oil (Bottle 75cl)", 1500)
    ],
    "Drinks, Alcohol & Mixers": [
        ("Coca Cola (50cl Pet)", 300), ("Fanta (50cl Pet)", 300),
        ("Schweppes Chapman", 500), ("Monster Energy Drink", 1200),
        ("Fearless Energy Drink", 600), ("Hollandia Yoghurt (1L)", 2200),
        ("Chivita 100% Juice", 2000), ("5 Alive Pulpy", 1500),
        ("Star Lager Beer", 700), ("Heineken (Bottle)", 900),
        ("Guinness Stout (Small)", 800), ("Orijin Bitters (Small)", 500),
        ("Smirnoff Ice", 800), ("Hennessy VS (Bottle)", 45000),
        ("Eva Water (75cl)", 200)
    ],
    "Toiletries & Hygiene": [
        ("Dettol Antiseptic (Small)", 1200), ("Hypo Bleach (Sachet)", 200),
        ("Sunlight Detergent (1kg)", 1600), ("WAW Detergent (1kg)", 1500),
        ("Morning Fresh Liquid (Small)", 900), ("Canoe Laundry Soap", 500),
        ("Lux Bath Soap", 600), ("Premier Cool Soap", 700),
        ("Oral-B Toothpaste (Large)", 1200), ("Close-Up (Large)", 1000),
        ("Nivea Body Lotion", 3500), ("Vaseline Blue Seal", 800),
        ("Always Sanitary Pad (8 count)", 1100)
    ],
    "Baby & Kids": [
        ("Pampers Diapers (Pack of 8)", 2500), ("Molfix Diapers (Jumbo)", 8500),
        ("Johnson's Baby Oil", 2200), ("Baby Wipes (Huggies)", 1500),
        ("Cerelac Wheat (Tin)", 4500), ("NAN 1 Baby Food", 6500),
        ("Ribena Drink", 400), ("Capri-Sun (Carton)", 4500)
    ],
    "Snacks & Biscuits": [
        ("Gala Sausage Roll", 200), ("Plantain Chips", 250),
        ("Pure Bliss Cookies", 300), ("Yale Bread", 1200),
        ("Butterfield Bread", 1400), ("McVities Digestives", 900),
        ("Coaster Biscuit", 200), ("Popcorn Pack", 400),
        ("Mentos Gum", 500)
    ],
    "Tech & Home Essentials": [
        ("Duracell AA Batteries (Pair)", 1500), ("Tiger Batteries (Pair)", 400),
        ("Extension Box (Generic)", 3500), ("iPhone Charging Cable", 3000),
        ("Android Type-C Cable", 1500), ("Earpiece (Wired)", 1000),
        ("Rechargeable Torch", 2500), ("Matches (Box)", 100)
    ]
}

class Command(BaseCommand):
    help = "Injects MASSIVE Realistic Nigerian Data into Tenant ID 1 (Batched Mode)"

    def handle(self, *args, **kwargs):
        target_tenant_id = 1

        self.stdout.write("🏗️  Spinning up the Reality Engine (Turbo Batch Mode)...")

        # --- 1. SETUP ---
        try:
            tenant = Tenant.objects.get(id=target_tenant_id)
            self.stdout.write(f"✅ Found Tenant: {tenant.name}")
        except Tenant.DoesNotExist:
            self.stdout.write(self.style.ERROR(f"❌ Tenant {target_tenant_id} not found!"))
            return

        cashier = User.objects.filter(tenant=tenant).first()
        if not cashier:
            self.stdout.write(self.style.ERROR("❌ No users found in this tenant."))
            return

        # Introspect Fields
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

        # --- 2. CLEAN SLATE ---
        self.stdout.write("🧹 Cleaning old simulation data...")
        Product.objects.filter(tenant=tenant, sku__startswith="SIM-").delete()
        Category.objects.filter(tenant=tenant, name__in=MARKET_CATALOG.keys()).delete()

        # --- 3. INVENTORY GENERATION ---
        self.stdout.write("📦 Stocking shelves...")
        all_products = []
        staple_products = []
        
        for cat_name, items in MARKET_CATALOG.items():
            category, _ = Category.objects.get_or_create(name=cat_name, tenant=tenant)
            for item_name, price in items:
                sku = f"SIM-{uuid.uuid4().hex[:8].upper()}"
                product = Product.objects.create(
                    name=item_name, sku=sku, price=price,
                    quantity=random.randint(2000, 5000), # Higher stock to prevent errors
                    category=category, tenant=tenant
                )
                all_products.append(product)
                if "Rice" in item_name or "Garri" in item_name or "Bread" in item_name:
                    staple_products.append(product)

        self.stdout.write(f"✅ Stocked {len(all_products)} products.")

        # --- 4. BATCHED SIMULATION ---
        days_back = 730 # 2 Years
        end_date = timezone.now()
        start_date = end_date - timedelta(days=days_back)
        
        # We split the work into Months to save memory
        current_date = start_date
        total_sales_count = 0

        self.stdout.write(f"🚀 Launching Time Machine (Processing Month by Month)...")

        while current_date <= end_date:
            # Calculate the end of this batch (Next 30 days)
            batch_end_date = min(current_date + timedelta(days=30), end_date)
            
            self.stdout.write(f"   🔄 Processing Batch: {current_date.strftime('%Y-%m-%d')} to {batch_end_date.strftime('%Y-%m-%d')}...")

            # KEY CHANGE: Transaction is now HERE. It saves every 30 days.
            with transaction.atomic():
                while current_date < batch_end_date:
                    # --- DAILY LOGIC ---
                    is_weekend = current_date.weekday() >= 5
                    day_of_month = current_date.day
                    month = current_date.month
                    
                    # Traffic
                    daily_customers = random.randint(30, 60)
                    if is_weekend: daily_customers = int(daily_customers * 1.4)
                    if 25 <= day_of_month <= 30: daily_customers = int(daily_customers * 1.8)
                    if month == 12: daily_customers = int(daily_customers * 2.2)

                    for _ in range(daily_customers):
                        # Simple Basket Logic
                        basket_size = random.choices([1, 2, 3, 5], weights=[40, 30, 15, 15])[0]
                        basket_items = random.sample(all_products, k=min(basket_size, len(all_products)))
                        total_amount = sum([p.price for p in basket_items])

                        # Create Sale
                        sale_kwargs = {
                            'tenant': tenant,
                            'total_amount': total_amount,
                            'payment_method': random.choice(['cash', 'pos']),
                        }
                        sale_kwargs[user_field_name] = cashier
                        if has_reference_field:
                            sale_kwargs['reference'] = f"REF-{uuid.uuid4().hex[:10].upper()}"

                        sale = Sale.objects.create(**sale_kwargs)
                        # Manual Timestamp Overwrite
                        Sale.objects.filter(id=sale.id).update(created_at=current_date)
                        
                        total_sales_count += 1

                        # Create Items
                        for prod in basket_items:
                            qty = 1 if prod.price > 2000 else random.randint(1, 3)
                            SaleItem.objects.create(
                                sale=sale, product=prod, quantity=qty,
                                unit_price=prod.price, subtotal=prod.price * qty
                            )
                    
                    current_date += timedelta(days=1)
            
            # END OF BATCH TRANSACTION - Data is saved to DB here!
            self.stdout.write(self.style.SUCCESS(f"      ✅ Batch Saved! (Total Sales so far: {total_sales_count})"))

        self.stdout.write(self.style.SUCCESS(f"✨ ALL DONE! Reality Engine finished."))
        self.stdout.write(self.style.SUCCESS(f"📊 Total Transactions: {total_sales_count}"))