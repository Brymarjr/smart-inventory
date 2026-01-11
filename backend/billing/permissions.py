from rest_framework import permissions

class IsCompanySuperUser(permissions.BasePermission):
    """
    Allows access only to global superusers who are not linked to any tenant.
    Prevents tenant-bound admins from accessing global admin endpoints.
    """

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        # Must be superuser AND have no tenant
        return user.is_superuser and not getattr(user, "tenant", None)
