"""
Django settings for smart_inventory project.
Unified Configuration: Works for Local Dev & Production (Render/Vercel)
"""

from pathlib import Path
import os
import ssl
from datetime import timedelta
import environ
import dj_database_url

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Initialize Environment Variables
env = environ.Env()

# Load .env file for local development
# (This file is ignored in production because Render sets env vars via Dashboard)
local_env_file = os.path.join(BASE_DIR, ".env")
if os.path.exists(local_env_file):
    env.read_env(local_env_file)

# --- CORE SETTINGS ---

# SECURITY WARNING: keep the secret key used in production secret!
# It will crash if SECRET_KEY is missing, ensuring you don't use unsafe defaults.
SECRET_KEY = env('SECRET_KEY')

# SECURITY WARNING: don't run with debug turned on in production!
# Defaults to False for safety. Set DEBUG=True in your local .env
DEBUG = env.bool('DEBUG', default=False)

# ALLOWED_HOSTS
# Local: ['localhost', '127.0.0.1']
# Render: Adds the .onrender.com domain automatically
ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=['localhost', '127.0.0.1'])
RENDER_EXTERNAL_HOSTNAME = os.environ.get('RENDER_EXTERNAL_HOSTNAME')
if RENDER_EXTERNAL_HOSTNAME:
    ALLOWED_HOSTS.append(RENDER_EXTERNAL_HOSTNAME)

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third Party
    'rest_framework',
    'corsheaders',
    'drf_spectacular',
    'django_celery_results',
    'django_celery_beat',
    'django_filters',
    # Internal Apps
    'tenants',
    'core',
    'inventory',
    'users',
    'billing',
    'purchases',
    'sales.apps.SalesConfig',
    'sync',
    'forecast',
    'notifications',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # Serves static files everywhere
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'tenants.middleware.TenantMiddleware',
    'tenants.auth_middleware.TenantAttachAfterJWTMiddleware',
    'tenants.middleware.BlockWriteIfSubscriptionExpiredMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'sync.middleware.SyncActivityLoggerMiddleware',
]

ROOT_URLCONF = 'smart_inventory.urls'
AUTH_USER_MODEL = 'users.User'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'smart_inventory.wsgi.application'

# --- DATABASE (POSTGRES EVERYWHERE) ---
# We removed the sqlite fallback. This forces you to define DATABASE_URL.
DATABASES = {
    'default': env.db('DATABASE_URL')
}

# --- REDIS & CELERY (SSL AWARE) ---
CELERY_BROKER_URL = env('CELERY_BROKER_URL', default='redis://localhost:6379/0')
CELERY_RESULT_BACKEND = env('CELERY_RESULT_BACKEND', default=CELERY_BROKER_URL)
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = "Africa/Lagos"
CELERY_BEAT_SCHEDULER = "django_celery_beat.schedulers:DatabaseScheduler"

# Fix for Upstash/Render (SSL):
# If the URL starts with 'rediss://' (secure), we tell Celery to ignore cert errors
if 'rediss://' in CELERY_BROKER_URL:
    CELERY_REDIS_BACKEND_USE_SSL = {"ssl_cert_reqs": ssl.CERT_NONE}
    CELERY_BROKER_USE_SSL = {"ssl_cert_reqs": ssl.CERT_NONE}

# --- EMAIL SETTINGS ---
# Uses SMTP by default. If EMAIL_HOST is missing, it crashes (good for catching errors).
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = env('EMAIL_HOST', default='smtp.gmail.com')
EMAIL_PORT = env.int('EMAIL_PORT', default=587)
EMAIL_USE_TLS = env.bool('EMAIL_USE_TLS', default=True)
EMAIL_HOST_USER = env('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = env('EMAIL_HOST_PASSWORD', default='')
DEFAULT_FROM_EMAIL = EMAIL_HOST_USER

# --- PASSWORD VALIDATION ---
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# --- INTERNATIONALIZATION ---
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# --- STATIC FILES ---
STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
# WhiteNoise handles static files in both Dev and Prod
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# --- CORS & CSRF ---
# Explicitly allow Localhost and your Vercel Domains
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# Add Vercel URL from environment (Production)
VERCEL_FRONTEND_DOMAIN = env('VERCEL_FRONTEND_DOMAIN', default=None)
if VERCEL_FRONTEND_DOMAIN:
    # Remove trailing slash if accidentally added
    CORS_ALLOWED_ORIGINS.append(VERCEL_FRONTEND_DOMAIN.rstrip('/'))

CSRF_TRUSTED_ORIGINS = env.list('CSRF_TRUSTED_ORIGINS', default=["http://localhost:3000"])

# --- DRF & AUTH ---
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'users.permissions.MustChangePasswordPermission',
        'rest_framework.permissions.IsAuthenticated',
        
        # 1. Check for Support Restrictions first
        'core.permissions.IsSupportReadOnly',
        
        # 2. Then check Tenant Subscription status
        'tenants.permissions.IsTenantActiveOrReadOnly',
    ),
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 10,
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=7),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': False,
    'BLACKLIST_AFTER_ROTATION': False,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# --- DOCUMENTATION ---
SPECTACULAR_SETTINGS = {
    'TITLE': 'Smart Inventory API',
    'DESCRIPTION': 'API schema for Smart Inventory.',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'POSTPROCESSING_HOOKS': [
        'core.openapi.add_x_tenant_parameter',
    ],
}

# --- LOGGING ---
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
}

# --- PAYSTACK ---
PAYSTACK_SECRET_KEY = env('PAYSTACK_SECRET_KEY', default='')
PAYSTACK_PUBLIC_KEY = env('PAYSTACK_PUBLIC_KEY', default='')
PAYSTACK_BASE_URL = 'https://api.paystack.co'
PAYSTACK_WEBHOOK_SECRET = env('PAYSTACK_WEBHOOK_SECRET', default=PAYSTACK_SECRET_KEY)

# --- SYNC SETTINGS ---
SYNC_ENABLED = True
SYNCED_MODELS = [
    "inventory.Category",
    "inventory.Product",
    "purchases.PurchaseOrder",
    "purchases.PurchaseItem",
    "sales.Sale",
    "sales.SaleItem",
]
SYNC_MODELS = SYNCED_MODELS
MAX_OPS_PER_UPLOAD = 500