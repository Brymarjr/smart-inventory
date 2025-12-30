# backend/billing/apps.py
from django.apps import AppConfig
import logging

logger = logging.getLogger(__name__)

class BillingConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'billing'

    def ready(self):
        """
        Register signals safely.
        Avoids database access at AppConfig import time.
        """
        try:
            import billing.signals  # noqa
            logger.info("🔔 Billing signals registered successfully.")
        except Exception as e:
            logger.exception("⚠️ Could not load billing signals: %s", e)
