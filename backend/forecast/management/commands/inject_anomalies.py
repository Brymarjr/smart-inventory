import random
import uuid  # <--- Added UUID for unique references
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.db import transaction
from tenants.models import Tenant
from inventory.models import Product, Category
from sales.models import Sale, SaleItem

User = get_user_model()

class Command(BaseCommand):
    help = "Surgically modifies data to FORCE AI Anomaly Detection triggers."

    def handle(self, *args, **kwargs):
        # CHANGE TO YOUR TENANT ID
        target_tenant_id = 1 
        
        self.stdout.write("💉 Initializing Chaos Injector (Anomaly Generator)...")

        try:
            tenant = Tenant.objects.get(id=target_tenant_id)
            user = User.objects.filter(tenant=tenant).first()
            if not user:
                self.stdout.write(self.style.ERROR("❌ No user found for this tenant!"))
                return
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"❌ Setup Error: {e}"))
            return

        # --- INTROSPECTION ---
        # 1. Find User Field
        user_field_name = None
        for field in Sale._meta.fields:
            if field.related_model == User:
                user_field_name = field.name
                break
        
        if not user_field_name:
            self.stdout.write(self.style.ERROR("❌ Could not find User ForeignKey in Sale model."))
            return

        # 2. Find Reference Field (THE FIX)
        has_reference_field = False
        for field in Sale._meta.fields:
            if field.name == 'reference':
                has_reference_field = True
                break

        self.stdout.write(f"✅ Setup: User Field='{user_field_name}', Has Reference='{has_reference_field}'")

        # Categories
        cat_prov, _ = Category.objects.get_or_create(name="Provisions", tenant=tenant)
        cat_drinks, _ = Category.objects.get_or_create(name="Drinks & Alcohol", tenant=tenant)

        today = timezone.now()
        yesterday = today - timedelta(days=1)
        
        # --- 1. THE "GHOST STOCK" SCENARIO ---
        self.stdout.write("👻 creating GHOST STOCK Scenario...")
        p_ghost, _ = Product.objects.update_or_create(
            sku="ANOM-GHOST", tenant=tenant,
            defaults={
                'name': 'Dangote Sugar (Ghost Batch)', 
                'price': 2500, 'category': cat_prov,
                'quantity': 200, 'reorder_level': 10
            }
        )
        self._generate_history(tenant, user, p_ghost, 60, 15, user_field_name, has_reference_field)
        
        # Delete last 7 days to trigger ghost alert
        cutoff = today - timedelta(days=7)
        SaleItem.objects.filter(product=p_ghost, sale__created_at__gte=cutoff).delete()
        self.stdout.write(f"   ✅ Created '{p_ghost.name}'.")


        # --- 2. THE "VELOCITY SPIKE" SCENARIO ---
        self.stdout.write("🚀 creating VELOCITY SPIKE Scenario...")
        p_spike, _ = Product.objects.update_or_create(
            sku="ANOM-SPIKE", tenant=tenant,
            defaults={
                'name': 'Orijin Bitters (Viral)', 
                'price': 500, 'category': cat_drinks,
                'quantity': 500, 'reorder_level': 50
            }
        )
        self._generate_history(tenant, user, p_spike, 60, 5, user_field_name, has_reference_field)
        self._create_single_sale(tenant, user, p_spike, yesterday, 200, user_field_name, has_reference_field)
        self.stdout.write(f"   ✅ Created '{p_spike.name}'.")


        # --- 3. THE "STOCKOUT RISK" SCENARIO ---
        self.stdout.write("⚠️ creating STOCKOUT RISK Scenario...")
        p_risk, _ = Product.objects.update_or_create(
            sku="ANOM-RISK", tenant=tenant,
            defaults={
                'name': 'Peak Milk (Critical)', 
                'price': 1200, 'category': cat_prov,
                'quantity': 30, 'reorder_level': 50
            }
        )
        self._generate_history(tenant, user, p_risk, 60, 20, user_field_name, has_reference_field)
        self.stdout.write(f"   ✅ Created '{p_risk.name}'.")

        self.stdout.write(self.style.SUCCESS("✨ Chaos Injection Complete."))

    def _generate_history(self, tenant, user, product, days, avg_qty, user_field_name, has_reference_field):
        end_date = timezone.now() - timedelta(days=8)
        start_date = end_date - timedelta(days=days)
        current = start_date

        with transaction.atomic():
            while current <= end_date:
                qty = random.randint(avg_qty - 2, avg_qty + 2)
                if qty < 1: qty = 1
                self._create_single_sale(tenant, user, product, current, qty, user_field_name, has_reference_field)
                current += timedelta(days=1)

    def _create_single_sale(self, tenant, user, product, date_obj, qty, user_field_name, has_reference_field):
        sale_kwargs = {
            'tenant': tenant,
            'total_amount': product.price * qty,
            'payment_method': 'cash',
            user_field_name: user 
        }

        # THE FIX: Generate Unique Reference if required
        if has_reference_field:
            sale_kwargs['reference'] = f"ANOM-{uuid.uuid4().hex[:12].upper()}"

        sale = Sale.objects.create(**sale_kwargs)
        Sale.objects.filter(id=sale.id).update(created_at=date_obj)

        SaleItem.objects.create(
            sale=sale, product=product, quantity=qty,
            unit_price=product.price, subtotal=product.price * qty
        )