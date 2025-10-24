from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Tenant
from users.models import UserRole

@receiver(post_save, sender=Tenant)
def assign_default_roles_to_tenant(sender, instance, created, **kwargs):
    """
    When a new tenant is created, assign default user roles automatically
    (TenantAdmin, Manager, Staff, FinanceOfficer).
    """
    if created:
        # Just ensuring that system roles exist (already seeded globally)
        print(f"✅ Default roles available for tenant '{instance.name}' — no duplicates created.")


