from django.apps import AppConfig
from django.db.utils import OperationalError, ProgrammingError


class BillingConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'billing'

    def ready(self):
        """
        Automatically ensure default pricing plans exist after migrations.
        Runs once when Django starts up and silently skips if DB not ready.
        """
        from billing.models import Plan

        try:
            # Avoid running before migrations or during flush/reset
            if not Plan.objects.exists():
                plans = [
                    Plan(
                        name="Free",
                        amount=0,
                        currency="NGN",
                        duration_days=30,
                        description="Basic free tier with limited users and features.",
                        is_active=True,
                    ),
                    Plan(
                        name="Pro",
                        amount=5000,
                        currency="NGN",
                        duration_days=30,
                        description="Pro plan with advanced features and up to 50 users.",
                        is_active=True,
                    ),
                    Plan(
                        name="Enterprise",
                        amount=15000,
                        currency="NGN",
                        duration_days=30,
                        description="Enterprise tier with unlimited users, reports, and premium support.",
                        is_active=True,
                    ),
                ]
                Plan.objects.bulk_create(plans)
                print("✅ Default plans created successfully.")
            else:
                print("ℹ️ Plans already exist — skipping auto-creation.")

        except (OperationalError, ProgrammingError):
            # Happens when DB isn't fully migrated yet
            pass

