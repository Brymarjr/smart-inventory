from rest_framework.permissions import BasePermission

class IsTenantActivePermission(BasePermission):
    """
    Global block for suspended tenants.
    Allows access to auth and support endpoints so they can login and contact support.
    """
    # This specific string is what our frontend will look for to trigger the redirect
    message = "tenant_suspended"

    def has_permission(self, request, view):
        # 1. Allow unauthenticated requests to pass through (so login works)
        if not request.user or not request.user.is_authenticated:
            return True

        # 2. System Admins bypass the block completely
        if request.user.is_superuser:
            return True

        # 3. Leave the lifeline open! Allow access to auth and support tickets
        path = request.path
        if path.startswith('/api/auth/') or path.startswith('/api/support/'):
            return True

        # 4. THE BLOCK: If the tenant is suspended, slam the door.
        tenant = getattr(request.user, 'tenant', None)
        if tenant and not tenant.is_active:
            return False

        return True