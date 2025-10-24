from django.db import models
from django.utils.text import slugify
from django.core.exceptions import ValidationError
from django.conf import settings

class Tenant(models.Model):
    """
    Tenant represents a single store (single-branch) in the multi-tenant system.
    Keep this lightweight; additional billing fields will be added in the billing app.
    """
    name = models.CharField(max_length=200, unique=True)
    slug = models.SlugField(max_length=100, unique=True)
    owner = models.ForeignKey( 
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="owned_tenants",
        null=True, blank=True
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def clean(self):
        if not self.slug:
            self.slug = slugify(self.name)

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


