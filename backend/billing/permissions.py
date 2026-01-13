from rest_framework import permissions

class IsCompanySuperUser(permissions.BasePermission):
    """
    Tiered Permissions for System Administration:
    1. Support Staff (is_superuser=True, is_staff=False): READ ONLY access.
    2. Main Admin (is_superuser=True, is_staff=True): FULL access (Extend, Cancel, etc).
    """

    def has_permission(self, request, view):
        user = request.user
        
        # 1. Basic Security: Must be logged in and NOT belong to a tenant
        if not user or not user.is_authenticated or getattr(user, "tenant", None):
            return False

        # 2. If the user is the 'Main Admin' (is_staff=True), they can do anything.
        if user.is_staff and user.is_superuser:
            return True

        # 3. If the user is 'Support Staff' (is_staff=False), they can ONLY Read.
        # SAFE_METHODS = GET, HEAD, OPTIONS
        if user.is_superuser and request.method in permissions.SAFE_METHODS:
            return True

        # 4. Block everything else (e.g. Support Staff trying to POST/Extend)
        return False
