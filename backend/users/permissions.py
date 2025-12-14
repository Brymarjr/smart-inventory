from rest_framework import permissions
from rest_framework.permissions import BasePermission


class IsTenantAdmin(permissions.BasePermission):
    """Allow access only to users with the TenantAdmin role."""
    def has_permission(self, request, view):
        user = request.user
        if user and user.is_authenticated and user.is_superuser:
            return True  # ✅ Always allow superusers
        return getattr(user.role, "name", None) == "tenant_admin"


class IsManager(permissions.BasePermission):
    """Allow access only to users with the Manager role."""
    def has_permission(self, request, view):
        user = request.user
        if user and user.is_authenticated and user.is_superuser:
            return True  # ✅ Always allow superusers
        return getattr(user.role, "name", None) == "manager"


class IsStaff(permissions.BasePermission):
    """Allow access only to users with the Staff role."""
    def has_permission(self, request, view):
        user = request.user
        if user and user.is_authenticated and user.is_superuser:
            return True  # ✅ Always allow superusers
        return getattr(user.role, "name", None) == "staff"


class IsFinanceOfficer(permissions.BasePermission):
    """Allow access only to users with the FinanceOfficer role."""
    def has_permission(self, request, view):
        user = request.user
        if user and user.is_authenticated and user.is_superuser:
            return True  # ✅ Always allow superusers
        return getattr(user.role, "name", None) == "finance_officer"


# 🔹 Composite permissions for common scenarios
class IsTenantAdminOrManager(permissions.BasePermission):
    """Allow access to both TenantAdmin and Manager roles."""
    def has_permission(self, request, view):
        user = request.user
        if user and user.is_authenticated and user.is_superuser:
            return True  # ✅ Always allow superusers
        return getattr(user.role, "name", None) in ["tenant_admin", "manager"]


class IsFinanceOrAdmin(permissions.BasePermission):
    """Allow access to FinanceOfficer and TenantAdmin roles."""
    def has_permission(self, request, view):
        user = request.user
        if user and user.is_authenticated and user.is_superuser:
            return True  # ✅ Always allow superusers
        return getattr(user.role, "name", None) in ["finance_officer", "tenant_admin"]


class IsTenantAdminManagerOrFinance(permissions.BasePermission):
    """Allow access to TenantAdmin, Manager, or FinanceOfficer roles."""
    def has_permission(self, request, view):
        user = request.user
        if user and user.is_authenticated and user.is_superuser:
            return True  # ✅ Always allow superusers
        return getattr(user.role, "name", None) in ["tenant_admin", "manager", "finance_officer"]


class IsStaffOrTenantAdminManagerOrFinance(permissions.BasePermission):
    """
    Staff can create purchase orders.
    Tenant Admins, Managers, and Finance can view and manage them.
    """
    def has_permission(self, request, view):
        user = request.user
        if user and user.is_authenticated and user.is_superuser:
            return True  # ✅ Always allow superusers
        return getattr(user.role, "name", None) in [
            "tenant_admin", "manager", "finance_officer", "staff"
        ]




class MustChangePasswordPermission(permissions.BasePermission):
    """
    Deny access to any endpoint for users who must change password,
    except for endpoints that allow password change/reset/login.
    """

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


