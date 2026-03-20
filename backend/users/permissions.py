from rest_framework import permissions
from rest_framework.permissions import BasePermission


class IsTenantAdmin(permissions.BasePermission):
    """Allow access only to users with the TenantAdmin role."""
    message = "Access Denied: This action requires Tenant Administrator privileges."
    
    def has_permission(self, request, view):
        user = request.user
        if user and user.is_authenticated and user.is_superuser:
            return True  # Always allow superusers
        return getattr(user.role, "name", None) == "tenant_admin"


class IsManager(permissions.BasePermission):
    """Allow access only to users with the Manager role."""
    message = "Access Denied: This action requires a Manager role."

    def has_permission(self, request, view):
        user = request.user
        if user and user.is_authenticated and user.is_superuser:
            return True  # Always allow superusers
        return getattr(user.role, "name", None) == "manager"


class IsStaff(permissions.BasePermission):
    """Allow access only to users with the Staff role."""
    message = "Access Denied: This action is restricted to Staff members."

    def has_permission(self, request, view):
        user = request.user
        if user and user.is_authenticated and user.is_superuser:
            return True  # Always allow superusers
        return getattr(user.role, "name", None) == "staff"


# Composite permissions for common scenarios
class IsTenantAdminOrManager(permissions.BasePermission):
    """Allow access to both TenantAdmin and Manager roles."""
    message = "Access Denied: You must be an Administrator or Manager to perform this task."

    def has_permission(self, request, view):
        user = request.user
        if user and user.is_authenticated and user.is_superuser:
            return True  # ✅ Always allow superusers
        return getattr(user.role, "name", None) in ["tenant_admin", "manager"]
    

class IsStaffOrManager(permissions.BasePermission):
    """Allow access to both Staff and Manager roles."""
    message = "Access Denied: This action is only available to Staff or Managers."

    def has_permission(self, request, view):
        user = request.user
        if user and user.is_authenticated and user.is_superuser:
            return True  # ✅ Always allow superusers
        return getattr(user.role, "name", None) in ["staff", "manager"]


class IsStaffOrTenantAdminManager(permissions.BasePermission):
    """
    Staff can create sales and purchase orders.
    Tenant Admins, Managers can view and manage them.
    """
    message = "Access Denied: Your account role does not have permission to access this resource."

    def has_permission(self, request, view):
        user = request.user
        if user and user.is_authenticated and user.is_superuser:
            return True  # ✅ Always allow superusers
        return getattr(user.role, "name", None) in [
            "tenant_admin", "manager", "staff"
        ]


class MustChangePasswordPermission(permissions.BasePermission):
    """
    Deny access to any endpoint for users who must change password,
    except for endpoints that allow password change/reset/login.
    """
    message = "Security Action Required: You must change your password before accessing the system."

    def has_permission(self, request, view):
        # Allow password-related endpoints
        allowed_views = [
            'TenantAwareAuthViewSet',
            'PasswordResetViewSet',
        ]
        allowed_actions = ['login', 'forgot_password', 'change_password', 'admin_reset_password']

        if view.__class__.__name__ in allowed_views or getattr(view, 'action', None) in allowed_actions:
            return True

        # Block all other endpoints if user must change password
        user = getattr(request, 'user', None)
        if user and user.is_authenticated and getattr(user, 'must_change_password', False):
            return False

        return True