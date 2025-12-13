from django_celery_beat.models import (
    CrontabSchedule,
    PeriodicTask,
)
import json


def _get_or_create_crontab(minute, hour, day_of_week='*'):
    schedule, _ = CrontabSchedule.objects.get_or_create(
        minute=minute,
        hour=hour,
        day_of_week=day_of_week,
        day_of_month='*',
        month_of_year='*',
    )
    return schedule


def setup_forecast_schedules():
    """
    Create or update Celery Beat schedules
    for forecasting tasks.
    """

    #  Weekly model training — Sunday 2am
    weekly_schedule = _get_or_create_crontab(
        minute='0',
        hour='2',
        day_of_week='0',  # Sunday
    )

    PeriodicTask.objects.update_or_create(
        name='Weekly Forecast Model Training',
        defaults={
            'task': 'forecast.tasks.train_models_for_all_tenants',
            'crontab': weekly_schedule,
            'args': json.dumps([]),
            'enabled': True,
        }
    )

    #  Daily forecast generation — 1am
    daily_schedule = _get_or_create_crontab(
        minute='0',
        hour='1',
    )

    PeriodicTask.objects.update_or_create(
        name='Daily Forecast Generation',
        defaults={
            'task': 'forecast.tasks.generate_forecasts_for_all_tenants',
            'crontab': daily_schedule,
            'args': json.dumps([]),
            'enabled': True,
        }
    )
