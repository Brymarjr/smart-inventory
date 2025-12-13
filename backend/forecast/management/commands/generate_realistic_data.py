import random
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from inventory.models import Category, Supplier, Product
from sales.models import Sale, SaleItem
from purchases.models import PurchaseOrder, PurchaseItem
from tenants.models import Tenant
from users.models import UserRole, User
from django.utils import timezone
from datetime import timedelta, date

UserModel = get_user_model()

NUM_TENANTS = 3
NUM_PRODUCTS_PER_TENANT = 50
NUM_MONTHS = 12  # full year
SALES_PER_DAY = (1, 5)
SALE_ITEM_MIN_QTY = 1
SALE_ITEM_MAX_QTY = 10
PURCHASES_PER_MONTH = (2, 5)

HOLIDAYS = [
    date(2025, 1, 1),   # New Year
    date(2025, 5, 1),   # Workers Day
    date(2025, 12, 25), # Christmas
    date(2025, 12, 26), # Boxing Day
]

CATEGORY_NAMES = ["Groceries", "Beverages", "Electronics", "Household", "Personal Care", "Phones & Accessories"]

NIGERIAN_PRODUCTS = [
    "Indomie Noodles", "Golden Morn Cereal", "Peak Milk", "Gino Pepper", "Dangote Sugar",
    "Honeywell Rice", "Maltina", "Amstel Malta", "Coca-Cola", "Fanta", "Pepsi",
    "Tecno Phone", "Samsung TV", "Infinix Phone", "LG TV", "Philips Blender",
    "Omo Washing Powder", "Sunlight Soap", "Ariel", "Close-up Toothpaste", "Nivea Cream",
    "Vaseline", "Lux Soap", "PZ Cussons Body Lotion"
]

NIGERIAN_SUPPLIERS = [
    "Lagos Distributors", "Abuja Trading Co", "Kano Wholesale Ltd", 
    "Port Harcourt Supplies", "Kaduna Enterprises", "Ibadan Trading Hub"
]

def decimal_multiplier(value, multiplier_min=0.9, multiplier_max=1.1):
    factor = Decimal(str(random.uniform(multiplier_min, multiplier_max)))
    return (value * factor).quantize(Decimal("0.01"))

def generate_unique_sale_reference(tenant_id):
    while True:
        ref = f"SAL-{tenant_id}-{random.randint(1000000000, 9999999999)}"
        if not Sale.objects.filter(reference=ref).exists():
            return ref

class Command(BaseCommand):
    help = "Generate realistic Nigerian fake data for tenants, users, inventory, sales, and purchases."

    def handle(self, *args, **kwargs):
        self.stdout.write("Starting realistic Nigerian fake data generation...")

        # 1. Roles
        roles = [
            ("tenant_admin", "Tenant Admin"),
            ("manager", "Manager"),
            ("staff", "Staff"),
            ("finance_officer", "Finance Officer"),
        ]
        for name, desc in roles:
            UserRole.objects.get_or_create(name=name, defaults={"description": desc})
        self.stdout.write("✅ Default roles available — no duplicates created.")

        # 2. Tenants
        tenants = []
        for i in range(1, NUM_TENANTS + 1):
            tenant, created = Tenant.objects.get_or_create(
                name=f"Tenant {i}", defaults={"slug": f"tenant-{i}"}
            )
            tenants.append(tenant)
        self.stdout.write(f"✅ Created {len(tenants)} tenants.")

        # 3. Users
        for tenant in tenants:
            User.objects.get_or_create(
                username=f"{tenant.name.lower().replace(' ', '_')}_admin",
                defaults={
                    "email": f"{tenant.slug}@example.com",
                    "tenant": tenant,
                    "role": UserRole.objects.get(name="tenant_admin"),
                },
            )
            User.objects.get_or_create(
                username=f"{tenant.name.lower().replace(' ', '_')}_staff",
                defaults={
                    "email": f"{tenant.slug}_staff@example.com",
                    "tenant": tenant,
                    "role": UserRole.objects.get(name="staff"),
                },
            )
        self.stdout.write("✅ Created users for tenants.")

        # 4. Categories & Suppliers
        categories = []
        suppliers = []
        for tenant in tenants:
            for cat_name in CATEGORY_NAMES:
                category, _ = Category.objects.get_or_create(tenant=tenant, name=cat_name)
                categories.append(category)
            for _ in range(3):
                supplier_name = random.choice(NIGERIAN_SUPPLIERS) + f" {random.randint(1, 50)}"
                supplier, _ = Supplier.objects.get_or_create(tenant=tenant, name=supplier_name)
                suppliers.append(supplier)
        self.stdout.write("✅ Created categories and suppliers.")

        # 5. Products
        products = []
        for tenant in tenants:
            for i in range(NUM_PRODUCTS_PER_TENANT):
                category = random.choice(categories)
                supplier = random.choice(suppliers)
                product_name = random.choice(NIGERIAN_PRODUCTS)
                price_range = {
                    "Groceries": (200, 2500),
                    "Beverages": (100, 1000),
                    "Electronics": (25000, 300000),
                    "Household": (500, 5000),
                    "Personal Care": (200, 2000),
                    "Phones & Accessories": (15000, 200000),
                }
                min_price, max_price = price_range.get(category.name, (200, 1000))
                price = Decimal(str(random.uniform(min_price, max_price))).quantize(Decimal("0.01"))

                product, _ = Product.objects.get_or_create(
                    tenant=tenant,
                    sku=f"SKU-{tenant.id}-{i+1}",
                    defaults={
                        "name": f"{product_name} {i+1}",
                        "category": category,
                        "supplier": supplier,
                        "price": price,
                        "quantity": random.randint(20, 500),
                        "reorder_level": random.randint(5, 50),
                    },
                )
                products.append(product)
        self.stdout.write("✅ Created products with realistic Nigerian names.")

        # 6. Purchases & Sales
        start_date = timezone.now() - timedelta(days=NUM_MONTHS * 30)
        for tenant in tenants:
            tenant_products = Product.objects.filter(tenant=tenant)

            # Purchases
            for month in range(NUM_MONTHS):
                for _ in range(random.randint(*PURCHASES_PER_MONTH)):
                    po = PurchaseOrder(
                        tenant=tenant,
                        created_by=User.objects.filter(tenant=tenant).first()
                    )
                    po.save()
                    for product in random.sample(list(tenant_products), k=5):
                        qty = random.randint(10, 50)
                        unit_cost = decimal_multiplier(product.price, 0.85, 1.15)
                        PurchaseItem.objects.create(
                            purchase=po,
                            product=product,
                            quantity=qty,
                            unit_cost=unit_cost,
                            subtotal=(unit_cost * qty).quantize(Decimal("0.01")),
                            new_price=unit_cost,
                        )
                        product.quantity += qty
                        product.save()

            # Sales
            current_date = start_date
            while current_date <= timezone.now():
                for _ in range(random.randint(*SALES_PER_DAY)):
                    sale_ref = generate_unique_sale_reference(tenant.id)
                    sale = Sale.objects.create(
                        tenant=tenant,
                        reference=sale_ref,
                        total_amount=Decimal("0.00"),
                        payment_method=random.choice([p[0] for p in Sale.PAYMENT_METHOD_CHOICES]),
                        created_by=User.objects.filter(tenant=tenant).first(),
                        created_at=current_date,
                    )
                    total = Decimal("0.00")
                    for product in random.sample(list(tenant_products), k=random.randint(2, 5)):
                        qty = random.randint(SALE_ITEM_MIN_QTY, SALE_ITEM_MAX_QTY)
                        if product.quantity <= 0:
                            continue
                        # Weekend sales spike
                        if current_date.weekday() >= 5:  # Saturday/Sunday
                            qty = int(qty * 1.5)
                        # Holiday boost
                        if current_date.date() in HOLIDAYS:
                            qty = int(qty * 2)
                        qty = min(qty, product.quantity)
                        subtotal = (product.price * qty).quantize(Decimal("0.01"))
                        SaleItem.objects.create(
                            sale=sale,
                            product=product,
                            quantity=qty,
                            unit_price=product.price,
                            subtotal=subtotal,
                        )
                        total += subtotal
                        product.quantity -= qty
                        product.save()
                    sale.total_amount = total
                    sale.save()
                current_date += timedelta(days=1)

        self.stdout.write(self.style.SUCCESS("✅ Realistic Nigerian fake data generation completed successfully."))
