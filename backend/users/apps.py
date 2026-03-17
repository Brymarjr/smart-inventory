from django.apps import AppConfig
from django.db.models.signals import post_migrate

class UsersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'users'

    def ready(self):
        # Import the signal function
        from .signals import create_system_roles
        # Connect it to the post_migrate hook
        post_migrate.connect(create_system_roles, sender=self)