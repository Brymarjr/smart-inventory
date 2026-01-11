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

# --- PERIODIC TASK SCHEDULE (The "Alarm Clock") ---
app.conf.beat_schedule = {
    # 1. THE BRAIN: Runs every night at 2:00 AM
    'run-daily-analytics-at-2am': {
        'task': 'forecast.tasks.run_analytics_for_all', 
        'schedule': crontab(hour=2, minute=0),  # 2:00 AM
        'args': (), 
    },
}