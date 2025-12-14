from django.contrib.auth.models import AbstractUser
from django.db import models
from tenants.models import Tenant


class User(AbstractUser):
    tenant = models.ForeignKey(
        "tenants.Tenant",
        on_delete=models.CASCADE,
        related_name="users",
        null=True,
        blank=True,
    )

    role = models.ForeignKey(
        "users.UserRole",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="users",
    )

    #  Password reset & security controls
    must_change_password = models.BooleanField(default=False)

    password_reset_sent_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the last password reset was issued"
    )

    password_reset_reason = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        help_text="Reason for reset: self_reset | admin_reset | system_reset"
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "email"],
                name="unique_tenant_email",
            ),
        ]

    def __str__(self):
        return f"{self.username} ({self.tenant})" if self.tenant else self.username


# ========================
# BUILT-IN ROLE MODEL
# ========================

class UserRole(models.Model):
    """
    Represents one of the 4 predefined system roles.
    Tenants cannot create or edit these roles.
    """
    ROLE_CHOICES = [
        ('tenant_admin', 'TenantAdmin'),
        ('manager', 'Manager'),
        ('staff', 'Staff'),
        ('finance_officer', 'FinanceOfficer'),
    ]

    name = models.CharField(max_length=50, choices=ROLE_CHOICES, unique=True, default='staff',)
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return dict(self.ROLE_CHOICES).get(self.name, self.name)
