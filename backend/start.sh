#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -o errexit

echo "📦 Running database migrations..."
python manage.py migrate --noinput

# (Optional) Collect static files if you are using Django admin
# python manage.py collectstatic --noinput

echo "🚀 Starting Celery Worker in the background..."
# CRITICAL: We limit concurrency to 2 so we don't blow up Render's 512MB memory limit!
celery -A smart_inventory worker -Q high_priority,default,emails --concurrency=2 --loglevel=info &

echo "⏰ Starting Celery Beat in the background..."
celery -A smart_inventory beat --loglevel=info &

echo "🌐 Starting Django Web Server..."
# Start Gunicorn in the foreground so Render knows the web service is running
gunicorn smart_inventory.wsgi:application --bind 0.0.0.0:$PORT --workers 2