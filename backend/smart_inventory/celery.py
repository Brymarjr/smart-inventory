import os
from celery import Celery
from celery.schedules import crontab

# Set the default Django settings module for 'celery'
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'smart_inventory.settings')

app = Celery('smart_inventory')

# Load settings from Django config, using the CELERY_ prefix
app.config_from_object('django.conf:settings', namespace='CELERY')

# Auto-discover tasks from all installed apps
app.autodiscover_tasks()

app.conf.beat_schedule = {
    "auto-renew-subscriptions-daily": {
        "task": "billing.tasks.auto_renew_subscriptions_task",
        "schedule": crontab(hour=0, minute=0),  # runs daily at midnight
    },
}