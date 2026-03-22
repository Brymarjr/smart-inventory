#!/bin/bash

set -o errexit

echo "📦 Running database migrations..."
python manage.py migrate --noinput

echo "🌱 Running Seeder (Checks for existing data)..."
python manage.py seed_three_months

echo "👤 Ensuring Superuser Access..."
# ✅ This line creates Chioma's account ONLY if it doesn't already exist
python manage.py shell -c "from django.contrib.auth import get_user_model; User = get_user_model(); User.objects.filter(email='chiomaiwegbuna@gmail.com').exists() or User.objects.create_superuser('Chioma', 'chiomaiwegbuna@gmail.com', 'chi123')"

echo "🧠 Initializing AI Brain..."
python manage.py shell -c "from forecast.tasks import run_analytics_for_all; run_analytics_for_all()"

echo "🚀 Starting Celery Worker..."
celery -A smart_inventory worker -Q high_priority,default,emails --concurrency=1 --loglevel=info &

echo "⏰ Starting Celery Beat..."
celery -A smart_inventory beat --loglevel=info &

echo "🌐 Starting Django Web Server..."
gunicorn smart_inventory.wsgi:application --bind 0.0.0.0:$PORT --workers 2