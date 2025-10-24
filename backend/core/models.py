import logging
from django.db import models
from core.tenant_context import get_current_tenant, TenantNotSetError
from .managers import SafeTenantManager

logger = logging.getLogger(__name__)


class TenantAwareManager(models.Manager):
    """
    Manager that automatically filters by the current tenant.
    Raises TenantNotSetError if no tenant is set (except during system operations like migrations).
    """

    def get_queryset(self):
        try:
            tenant = get_current_tenant()
        except TenantNotSetError:
            # During system operations (like migrations or shell), allow safe fallback
            import sys
            from django.core.management import base as management_base

            # Check if we're running a management command (makemigrations, migrate, shell, etc.)
            if any(cmd in sys.argv for cmd in ["makemigrations", "migrate", "shell", "createsuperuser", "collectstatic"]):
                return super().get_queryset().none()

            # Otherwise, this is a real runtime error
            raise

        if tenant is None:
            # Explicitly handle unset tenant case (not caught by TenantNotSetError)
            import sys
            if any(cmd in sys.argv for cmd in ["makemigrations", "migrate", "shell", "createsuperuser", "collectstatic"]):
                return super().get_queryset().none()
            raise TenantNotSetError()

        return super().get_queryset().filter(tenant=tenant)

    def create(self, **kwargs):
        tenant = get_current_tenant()
        if not tenant:
            raise TenantNotSetError("Cannot create object without active tenant.")
        kwargs.setdefault("tenant", tenant)
        return super().create(**kwargs)

    
    
class TenantAwareModel(models.Model):
    tenant = models.ForeignKey("tenants.Tenant", on_delete=models.CASCADE)

    objects = SafeTenantManager()  

    class Meta:
        abstract = True