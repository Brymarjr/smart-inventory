import uuid
import random
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.db import transaction
from tenants.models import Tenant
from inventory.models import Product, Category
from sales.models import Sale, SaleItem

class Command(BaseCommand):
    help = "Surgical repair of the 3 Anomaly Products (Bypasses stock checks)"

    def handle(self, *args, **kwargs):
        self.stdout.write("🚑 Starting Surgical Repair...")

        # 1. SETUP
        try:
            tenant = Tenant.objects.get(id=1)
        except Tenant.DoesNotExist:
            self.stdout.write(self.style.ERROR("❌ Tenant ID 1 not found"))
            return

        User = get_user_model()
        user = User.objects.filter(tenant=tenant).first()
        today = timezone.now()
        yesterday = today - timedelta(days=1)
        
        # 2. CLEANUP 
        targets = ["Dangote Sugar (Ghost Batch)", "Orijin Bitters (Viral)", "Peak Milk (Critical)"]
        self.stdout.write("   🧹 Removing old sales history for target items...")
        SaleItem.objects.filter(product__name__in=targets, sale__tenant=tenant).delete()
        Product.objects.filter(name__in=targets, tenant=tenant).delete()

        # 3. SETUP CATEGORIES
        cat_prov, _ = Category.objects.get_or_create(name="Provisions", tenant=tenant)
        cat_drinks, _ = Category.objects.get_or_create(name="Drinks & Alcohol", tenant=tenant)

        # --- A. INJECT "GHOST STOCK" (Dangote Sugar) ---
        self.stdout.write("   👻 Injecting Dangote Sugar (Ghost)...")
        p_ghost = Product.objects.create(
            name="Dangote Sugar (Ghost Batch)",
            tenant=tenant,
            quantity=100, 
            price=2500, cost_price=2100,
            category=cat_prov, 
            sku=f"SKU-GHOST-{uuid.uuid4().hex[:4]}"
        )
        
        # FIX: Inject MORE history (60 sales over past 60 days) to prove it is a popular item
        # This raises avg_sales > 1.0, enabling the alert
        curr_date = today - timedelta(days=67)
        for _ in range(60): 
            self._create_safe_sale(tenant, user, p_ghost, curr_date, random.randint(2, 5))
            curr_date += timedelta(days=1)

        # FORCE THE ANOMALY: High Stock, No Recent Sales
        Product.objects.filter(id=p_ghost.id).update(quantity=800)


        # --- B. INJECT "VELOCITY SPIKE" (Orijin Bitters) ---
        self.stdout.write("   🚀 Injecting Orijin Bitters (Viral)...")
        p_spike = Product.objects.create(
            name="Orijin Bitters (Viral)",
            tenant=tenant,
            quantity=1000, 
            price=500, cost_price=350,
            category=cat_drinks, 
            sku=f"SKU-VIRAL-{uuid.uuid4().hex[:4]}"
        )
        
        # The Viral Event (Yesterday) - Sold 200 at once
        self._create_safe_sale(tenant, user, p_spike, yesterday, 200, is_viral=True)
        Product.objects.filter(id=p_spike.id).update(quantity=400)


        # --- C. INJECT "STOCKOUT RISK" (Peak Milk) ---
        self.stdout.write("   ⚠️  Injecting Peak Milk (Critical)...")
        p_risk = Product.objects.create(
            name="Peak Milk (Critical)",
            tenant=tenant,
            quantity=1000, 
            price=6500, cost_price=5600, 
            category=cat_prov, 
            sku=f"SKU-RISK-{uuid.uuid4().hex[:4]}"
        )
        
        # Consistent Daily Sales
        curr = today - timedelta(days=30)
        while curr < today:
            self._create_safe_sale(tenant, user, p_risk, curr, 2)
            curr += timedelta(days=1)

        # FORCE THE ANOMALY: Critical Low Stock
        Product.objects.filter(id=p_risk.id).update(quantity=12)

        self.stdout.write(self.style.SUCCESS("✅ Repair Complete. The 3 Anomalies are guaranteed."))

    def _create_safe_sale(self, tenant, user, product, date, qty, is_viral=False):
        """Helper to create sales safely"""
        ref_prefix = "VIRAL" if is_viral else "REC"
        unique_ref = f"{ref_prefix}-{uuid.uuid4().hex[:10].upper()}"
        
        s = Sale.objects.create(
            tenant=tenant,
            total_amount=product.price * qty,
            payment_method='transfer' if is_viral else 'cash',
            created_by=user,
            reference=unique_ref
        )
        Sale.objects.filter(id=s.id).update(created_at=date)
        SaleItem.objects.create(sale=s, product=product, quantity=qty, unit_price=product.price, subtotal=product.price * qty)