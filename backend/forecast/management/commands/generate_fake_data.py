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

UserModel = get_user_model()

NUM_TENANTS = 3
NUM_PRODUCTS_PER_TENANT = 50
NUM_MONTHS = 6
SALES_PER_WEEK = (5, 15)
SALE_ITEM_MIN_QTY = 1
SALE_ITEM_MAX_QTY = 5
PURCHASES_PER_MONTH = (2, 6)


def decimal_multiplier(value, multiplier_min=0.8, multiplier_max=1.2):
    factor = Decimal(str(random.uniform(multiplier_min, multiplier_max)))
    return (value * factor).quantize(Decimal("0.01"))


def generate_unique_sale_reference(tenant_id):
    while True:
        ref = f"SAL-{tenant_id}-{random.randint(1000000000, 9999999999)}"
        if not Sale.objects.filter(reference=ref).exists():
            return ref


class Command(BaseCommand):
    help = "Generate realistic fake data for tenants, users, inventory, sales, and purchases."

    def handle(self, *args, **kwargs):
        self.stdout.write("Starting fake data generation...")

        # 1. Roles
        roles = [
            ("tenant_admin", "TenantAdmin"),
            ("manager", "Manager"),
            ("staff", "Staff"),
            ("finance_officer", "FinanceOfficer"),
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
            for i in range(3):
                category, _ = Category.objects.get_or_create(
                    tenant=tenant, name=f"Category {i+1}"
                )
                categories.append(category)
            for i in range(3):
                supplier, _ = Supplier.objects.get_or_create(
                    tenant=tenant, name=f"Supplier {i+1}"
                )
                suppliers.append(supplier)
        self.stdout.write("✅ Created categories and suppliers.")

        # 5. Products
        products = []
        for tenant in tenants:
            for i in range(NUM_PRODUCTS_PER_TENANT):
                category = random.choice(categories)
                supplier = random.choice(suppliers)
                price = Decimal(str(random.uniform(10.0, 500.0))).quantize(Decimal("0.01"))
                product, _ = Product.objects.get_or_create(
                    tenant=tenant,
                    sku=f"SKU-{tenant.id}-{i+1}",
                    defaults={
                        "name": f"Product {i+1}",
                        "category": category,
                        "supplier": supplier,
                        "price": price,
                        "quantity": random.randint(10, 100),
                        "reorder_level": random.randint(5, 20),
                    },
                )
                products.append(product)
        self.stdout.write("✅ Created products.")

        # 6. Purchases & Sales
        start_date = timezone.now() - timezone.timedelta(weeks=NUM_MONTHS * 4)
        for tenant in tenants:
            tenant_products = Product.objects.filter(tenant=tenant)

            # Purchases
            for month in range(NUM_MONTHS):
                for _ in range(random.randint(*PURCHASES_PER_MONTH)):
                    po = PurchaseOrder(
                        tenant=tenant,
                        created_by=User.objects.filter(tenant=tenant).first()
                    )
                    po.save()  # triggers unique reference logic

                    for product in random.sample(list(tenant_products), k=5):
                        qty = random.randint(5, 20)
                        unit_cost = decimal_multiplier(product.price, 0.8, 1.2)
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
                for _ in range(random.randint(*SALES_PER_WEEK)):
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
                    for product in random.sample(list(tenant_products), k=3):
                        qty = random.randint(SALE_ITEM_MIN_QTY, SALE_ITEM_MAX_QTY)
                        if product.quantity <= 0:
                            continue
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
                current_date += timezone.timedelta(weeks=1)

        self.stdout.write(self.style.SUCCESS("✅ Fake data generation completed successfully."))
