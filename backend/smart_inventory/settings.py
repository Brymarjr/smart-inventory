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
from corsheaders.defaults import default_headers

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Initialize Environment Variables
env = environ.Env()

# Load .env file for local development
local_env_file = os.path.join(BASE_DIR, ".env")
if os.path.exists(local_env_file):
    env.read_env(local_env_file)

# --- CORE SETTINGS ---

SECRET_KEY = env('SECRET_KEY')
DEBUG = env.bool('DEBUG', default=False)

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
    'support',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware', # MUST BE FIRST
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'tenants.middleware.TenantMiddleware',
    'tenants.auth_middleware.TenantAttachAfterJWTMiddleware',
    'tenants.middleware.GlobalTenantSuspensionMiddleware',
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

# --- DATABASE ---
DATABASES = {
    'default': env.db('DATABASE_URL')
}

# --- REDIS & CELERY ---
CELERY_BROKER_URL = env('REDIS_URL', default='redis://localhost:6379/0')
CELERY_RESULT_BACKEND = env('CELERY_RESULT_BACKEND', default=CELERY_BROKER_URL)
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = "Africa/Lagos"
CELERY_BEAT_SCHEDULER = "django_celery_beat.schedulers:DatabaseScheduler"

if 'rediss://' in CELERY_BROKER_URL:
    CELERY_REDIS_BACKEND_USE_SSL = {"ssl_cert_reqs": ssl.CERT_NONE}
    CELERY_BROKER_USE_SSL = {"ssl_cert_reqs": ssl.CERT_NONE}
    
CELERY_TASK_DEFAULT_QUEUE = 'default'
CELERY_TASK_ROUTES = {
    'sync.tasks.process_sync_job': {'queue': 'high_priority'},
    'notifications.tasks.send_notification_email': {'queue': 'emails'},
    'sales.tasks.notify_low_stock': {'queue': 'emails'},
    'sales.tasks.send_weekly_reports': {'queue': 'emails'},
    'users.tasks.send_password_reset_email': {'queue': 'emails'},
}

# --- EMAIL SETTINGS ---
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
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# --- CORS & CSRF ---

# Permissive mode for production defense
CORS_ALLOW_ALL_ORIGINS = True 
CORS_ALLOW_CREDENTIALS = True

# Prevent internal redirects from stripping headers
APPEND_SLASH = False

CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# Add Vercel URL from environment
VERCEL_FRONTEND_DOMAIN = env('VERCEL_FRONTEND_DOMAIN', default=None)
if VERCEL_FRONTEND_DOMAIN:
    CORS_ALLOWED_ORIGINS.append(VERCEL_FRONTEND_DOMAIN.rstrip('/'))

# Sync CORS with CSRF Trusted Origins
CSRF_TRUSTED_ORIGINS = env.list('CSRF_TRUSTED_ORIGINS', default=["http://localhost:3000"])
for origin in CSRF_TRUSTED_ORIGINS:
    if origin not in CORS_ALLOWED_ORIGINS:
        CORS_ALLOWED_ORIGINS.append(origin.rstrip('/'))

# Explicitly allow methods to ensure headers attach to error responses
CORS_ALLOW_METHODS = [
    "DELETE",
    "GET",
    "OPTIONS",
    "PATCH",
    "POST",
    "PUT",
]

# Explicitly allow standard and custom headers
CORS_ALLOW_HEADERS = list(default_headers) + [
    "x-tenant",
    "authorization",
    "content-type",
    "accept",
    "origin",
    "device-id",
]

# --- DRF & AUTH ---
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'users.permissions.MustChangePasswordPermission',
        'rest_framework.permissions.IsAuthenticated',
        'core.permissions.IsSupportReadOnly',
        'tenants.permissions.IsTenantActivePermission',
    ),
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 10,
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# --- DOCUMENTATION ---
SPECTACULAR_SETTINGS = {
    'TITLE': 'Fore Track API',
    'DESCRIPTION': 'API schema for Fore Track.',
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

CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": env('REDIS_URL', default='redis://localhost:6379/1'),
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
            "SOCKET_CONNECT_TIMEOUT": 2,  
            "SOCKET_TIMEOUT": 2,
        }
    }
}