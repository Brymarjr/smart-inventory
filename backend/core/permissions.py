from rest_framework.permissions import BasePermission, SAFE_METHODS

class IsSupportReadOnly(BasePermission):
    """
    Control access for the System Admin Dashboard.

    1. Support Staff (is_superuser=True, is_staff=False):
       - These are restricted admins.
       - They can VIEW data (GET) but cannot EDIT or DELETE.
       
    2. Full Admins (is_superuser=True, is_staff=True):
       - These are the owners/developers.
       - They are ignored by this permission (return True), so they have full write access.

    3. Regular Tenants (is_superuser=False):
       - Ignored by this permission (return True).
       - Their restrictions are handled by IsTenantActiveOrReadOnly.
    """
    
    message = "Support accounts are restricted to Read-Only access."

    def has_permission(self, request, view):
        # 1. Check if user is authenticated
        if not request.user or not request.user.is_authenticated:
            return False

        # 2. Identify 'Restricted Support Staff'
        # They have Superuser powers (to see data) but NO Staff status (no Django Admin access).
        is_restricted_support = request.user.is_superuser and not request.user.is_staff

        if is_restricted_support:
            # If they are restricted support, strictly allow only Safe Methods.
            return request.method in SAFE_METHODS

        # 3. Everyone else (Full Admins & Tenants) is allowed to pass.
        # Full Admins can write. Tenants are filtered by the next permission class.
        return True