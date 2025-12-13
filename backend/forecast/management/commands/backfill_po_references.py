# forecast/management/commands/backfill_po_references.py

from django.core.management.base import BaseCommand
from purchases.models import PurchaseOrder
from django.utils import timezone

class Command(BaseCommand):
    help = "Backfill PurchaseOrder references to ensure uniqueness per tenant/year."

    def handle(self, *args, **kwargs):
        self.stdout.write("Starting backfill of PurchaseOrder references...")

        for po in PurchaseOrder.objects.all().order_by('id'):
            if not po.reference:
                po.save()  # will auto-generate reference using save() logic
            else:
                # Check if reference conflicts exist
                existing = PurchaseOrder.objects.filter(
                    tenant=po.tenant,
                    created_at__year=po.created_at.year,
                    reference=po.reference
                ).exclude(id=po.id)
                if existing.exists():
                    po.reference = None
                    po.save()
            self.stdout.write(f"✅ PO ID {po.id} now has reference {po.reference}")

        self.stdout.write(self.style.SUCCESS("✅ Backfill completed successfully."))
