from django.db import migrations

def seed_user_roles(apps, schema_editor):
    UserRole = apps.get_model('users', 'UserRole')

    roles = [
        ('tenant_admin', 'TenantAdmin', 'Full access to tenant resources'),
        ('manager', 'Manager', 'Can manage inventory and view reports'),
        ('staff', 'Staff', 'Can perform basic operations'),
        ('finance_officer', 'FinanceOfficer', 'Handles purchase approvals and payments'),
    ]

    for name, display_name, description in roles:
        UserRole.objects.get_or_create(
            name=name,
            defaults={'description': description}
        )

def unseed_user_roles(apps, schema_editor):
    UserRole = apps.get_model('users', 'UserRole')
    UserRole.objects.filter(
        name__in=['tenant_admin', 'manager', 'staff', 'finance_officer']
    ).delete()

class Migration(migrations.Migration):

    dependencies = [
        ('users', '0006_alter_role_unique_together_remove_role_tenant_and_more'),
    ]

    operations = [
        migrations.RunPython(seed_user_roles, unseed_user_roles),
    ]

