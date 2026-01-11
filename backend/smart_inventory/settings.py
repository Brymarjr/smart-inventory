"""
Django settings for smart_inventory project.
Optimized for: Render (Backend) + Vercel (Frontend) + Neon (DB)
"""

from pathlib import Path
import os
from datetime import timedelta
import environ

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env()

# Load local env file if it exists (for local testing)
local_env_file = os.path.join(BASE_DIR, ".env.local")
if os.path.exists(local_env_file):
    env.read_env(local_env_file)

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = env('SECRET_KEY', default='unsafe-build-key-only-for-render')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = env.bool('DEBUG', default=False)

# ✅ RENDER FIX: Render gives us a hostname environment variable. We add it automatically.
ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=['localhost', '127.0.0.1'])
RENDER_EXTERNAL_HOSTNAME = os.environ.get('RENDER_EXTERNAL_HOSTNAME')
if RENDER_EXTERNAL_HOSTNAME:
    ALLOWED_HOSTS.append(RENDER_EXTERNAL_HOSTNAME)

FRONTEND_BASE_URL = env('FRONTEND_BASE_URL', default='http://localhost:3000')

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',           
    'corsheaders',               
    'drf_spectacular',  
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
    'django_celery_results',
    'django_celery_beat',
]

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

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    
    # ✅ RENDER FIX: WhiteNoise must be here to serve static files (CSS)
    'whitenoise.middleware.WhiteNoiseMiddleware', 
    
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    "tenants.middleware.TenantMiddleware",
    "tenants.auth_middleware.TenantAttachAfterJWTMiddleware",
    "tenants.middleware.BlockWriteIfSubscriptionExpiredMiddleware",
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

# ✅ DATABASE FIX: Use env.db() to parse the Neon/Render Connection String automatically
# In .env, you will simply set: DATABASE_URL=postgres://user:pass@neon-host/dbname
DATABASES = {
    'default': env.db('DATABASE_URL', default='sqlite:///db.sqlite3')
}

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# ✅ STATIC FILES FIX: Configure WhiteNoise
STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
# This ensures that even if you forget to run collectstatic, WhiteNoise tries its best
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ✅ CORS CONFIGURATION (Critical for Vercel)
# We allow localhost for dev, and load production domains from env
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# Add Vercel URL from environment if present
VERCEL_FRONTEND_DOMAIN = env('VERCEL_FRONTEND_DOMAIN', default=None)
if VERCEL_FRONTEND_DOMAIN:
    CORS_ALLOWED_ORIGINS.append(VERCEL_FRONTEND_DOMAIN)

from corsheaders.defaults import default_headers
CORS_ALLOW_HEADERS = list(default_headers) + [
    "x-tenant",
]
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = env.list('CSRF_TRUSTED_ORIGINS', default=["http://localhost:3000"])

# REST Framework config
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'users.permissions.MustChangePasswordPermission',
        'rest_framework.permissions.IsAuthenticated',
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

# drf-spectacular
SPECTACULAR_SETTINGS = {
    'TITLE': 'Smart Inventory API',
    'DESCRIPTION': 'API schema for Smart Inventory (multi-tenant retail system).',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'POSTPROCESSING_HOOKS': [
        'core.openapi.add_x_tenant_parameter',
    ],
}

# ✅ LOGGING FIX: Render logs to Console (Stdout), not files
# Files on Render are deleted every time you deploy.
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
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": os.getenv("DJANGO_LOG_LEVEL", "INFO"),
            "propagate": False,
        },
        "sync": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        }
    },
}

# Paystack
PAYSTACK_SECRET_KEY = env('PAYSTACK_SECRET_KEY', default='')
PAYSTACK_PUBLIC_KEY = env('PAYSTACK_PUBLIC_KEY', default='')
PAYSTACK_BASE_URL = env('PAYSTACK_BASE_URL', default='https://api.paystack.co')
PAYSTACK_WEBHOOK_SECRET = env('PAYSTACK_WEBHOOK_SECRET', default=PAYSTACK_SECRET_KEY)

# Celery
CELERY_BROKER_URL = env('CELERY_BROKER_URL', default='redis://localhost:6379/0')
CELERY_RESULT_BACKEND = CELERY_BROKER_URL
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = "Africa/Lagos"
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60
CELERY_TASK_SOFT_TIME_LIMIT = 25 * 60
CELERY_TASK_DEFAULT_QUEUE = "default"
CELERY_BEAT_SCHEDULER = "django_celery_beat.schedulers:DatabaseScheduler"

# Email
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = env('EMAIL_HOST', default='localhost')
EMAIL_PORT = env('EMAIL_PORT', default=25, cast=int)
EMAIL_USE_TLS = env.bool('EMAIL_USE_TLS', default=False)
EMAIL_HOST_USER = env('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = env('EMAIL_HOST_PASSWORD', default='')
DEFAULT_FROM_EMAIL = EMAIL_HOST_USER
SUPPORT_EMAIL = "braimaholatilewa@gmail.com"