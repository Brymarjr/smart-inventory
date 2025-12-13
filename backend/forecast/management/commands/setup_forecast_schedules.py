from django.core.management.base import BaseCommand
from forecast.schedules import setup_forecast_schedules


class Command(BaseCommand):
    help = "Setup Celery Beat schedules for forecasting"

    def handle(self, *args, **options):
        setup_forecast_schedules()
        self.stdout.write(
            self.style.SUCCESS("Forecast schedules set up successfully.")
        )
