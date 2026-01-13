import getpass
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

User = get_user_model()

class Command(BaseCommand):
    help = 'Creates a restricted Support User (Superuser=True, Staff=False)'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING('Creating a Restricted Support Account...'))

        # 1. Get Username/Email
        # Adjust 'username' or 'email' based on your USERNAME_FIELD
        username = input("Username: ")
        email = input("Email: ")
        
        # 2. Get Password (hidden input)
        password = getpass.getpass("Password: ")
        password_confirm = getpass.getpass("Password (again): ")

        if password != password_confirm:
            self.stdout.write(self.style.ERROR("Error: Passwords do not match."))
            return

        # 3. Create the User
        try:
            # We assume your model uses 'create_user'. 
            # If you use 'create_superuser', it forces is_staff=True, so we avoid that.
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password
            )

            # 4. Apply Permissions Programmatically
            user.is_superuser = True
            user.is_staff = False  
            user.is_active = True
            
            # FORCE PASSWORD CHANGE
            user.must_change_password = True 
            
            user.save()

            self.stdout.write(self.style.SUCCESS(f"Successfully created support user: {username}"))
            self.stdout.write(self.style.WARNING("NOTE: User will be forced to change password on first login."))
            self.stdout.write(self.style.SUCCESS("Access Level: READ-ONLY (via System Dashboard)"))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error creating user: {e}"))