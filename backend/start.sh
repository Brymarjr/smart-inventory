#!/bin/bash

set -o errexit

echo "📦 Running database migrations..."
python manage.py migrate --noinput

echo "🌱 Running Seeder (Checks for existing data)..."
# Since data exists, this will now skip in ~1 second
python manage.py seed_three_months

echo "👤 Ensuring Superuser Access..."
# Checks if Chioma exists; if yes, skips. No memory impact.
python manage.py shell -c "from django.contrib.auth import get_user_model; User = get_user_model(); User.objects.filter(email='chiomaiwegbuna@gmail.com').exists() or User.objects.create_superuser('Chioma', 'chiomaiwegbuna@gmail.com', 'chi123')"

# ✅ REMOVED: Initializing AI Brain (To prevent 512MB RAM crash)
# You will trigger this manually via your System Admin API once live.

echo "🚀 Starting Celery Worker..."
# Concurrency 1 is perfect for the free tier
celery -A smart_inventory worker -Q high_priority,default,emails --concurrency=1 --loglevel=info &

echo "⏰ Starting Celery Beat..."
celery -A smart_inventory beat --loglevel=info &

echo "🌐 Starting Django Web Server..."
gunicorn smart_inventory.wsgi:application --bind 0.0.0.0:$PORT --workers 2