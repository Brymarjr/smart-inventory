from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.db import transaction

def _ensure_permission(app_label: str, perm_code: str, name: str = None) -> Permission:
    """
    Ensure a Permission exists for given app_label and perm_code.
    We create a generic ContentType model 'customperm' under that app_label if needed.
    """
    content_type, _ = ContentType.objects.get_or_create(app_label=app_label, model="customperm")
    perm_name = name or perm_code.replace("_", " ").title()
    perm, _ = Permission.objects.get_or_create(codename=perm_code, content_type=content_type, defaults={"name": perm_name})
    return perm


@transaction.atomic
def sync_role_permissions_to_user(user, role):
    """
    Add all RolePermission codenames from `role` to `user.user_permissions`.
    Expects role.permissions to exist and each role_perm.codename to be in format "app_label.codename".
    """
    # iterate explicitly and add
    for role_perm in role.permissions.all():
        codename_full = role_perm.codename.strip()
        if "." not in codename_full:
            # skip malformed ones; or you can log/raise
            continue
        app_label, perm_code = codename_full.split(".", 1)
        perm = _ensure_permission(app_label, perm_code, role_perm.description or perm_code)
        user.user_permissions.add(perm)
    user.save()


@transaction.atomic
def remove_role_permissions_from_user(user, role):
    """
    Remove all RolePermission codenames belonging to `role` from `user.user_permissions`.
    Careful: this removes only permissions that match the role's permission list.
    """
    to_remove = []
    for role_perm in role.permissions.all():
        codename_full = role_perm.codename.strip()
        if "." not in codename_full:
            continue
        app_label, perm_code = codename_full.split(".", 1)
        # attempt to find permission
        perms = Permission.objects.filter(content_type__app_label=app_label, codename=perm_code)
        to_remove.extend(list(perms))

    if to_remove:
        for p in to_remove:
            user.user_permissions.remove(p)
    user.save()

