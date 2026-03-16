from django.db.models.signals import post_migrate
from django.dispatch import receiver

def create_system_roles(sender, **kwargs):
    """
    Ensures that the 3 core roles always exist in the database
    immediately after any migration runs.
    """
    # This prevents the logic from running multiple times for every app
    if sender.name == 'users':
        from users.models import UserRole
        
        roles = [
            ('tenant_admin', 'TenantAdmin', 'Full access to tenant resources'),
            ('manager', 'Manager', 'Can manage inventory and view reports'),
            ('staff', 'Staff', 'Can perform basic sales operations'),
        ]
        
        for name, label, desc in roles:
            role, created = UserRole.objects.get_or_create(
                name=name,
                defaults={'description': desc}
            )
            if created:
                print(f"🛠️  Self-Healing: Created missing role '{label}'")