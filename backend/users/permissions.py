from rest_framework import permissions

class IsTenantAdmin(permissions.BasePermission):
    """Allow access only to users with the TenantAdmin role."""
    def has_permission(self, request, view):
        return (
            request.user 
            and request.user.is_authenticated 
            and getattr(request.user.role, "name", None) == "tenant_admin"
        )


class IsManager(permissions.BasePermission):
    """Allow access only to users with the Manager role."""
    def has_permission(self, request, view):
        return (
            request.user 
            and request.user.is_authenticated 
            and getattr(request.user.role, "name", None) == "manager"
        )


class IsStaff(permissions.BasePermission):
    """Allow access only to users with the Staff role."""
    def has_permission(self, request, view):
        return (
            request.user 
            and request.user.is_authenticated 
            and getattr(request.user.role, "name", None) == "staff"
        )


class IsFinanceOfficer(permissions.BasePermission):
    """Allow access only to users with the FinanceOfficer role."""
    def has_permission(self, request, view):
        return (
            request.user 
            and request.user.is_authenticated 
            and getattr(request.user.role, "name", None) == "finance_officer"
        )


# 🔹 Composite permissions for common scenarios
class IsTenantAdminOrManager(permissions.BasePermission):
    """Allow access to both TenantAdmin and Manager roles."""
    def has_permission(self, request, view):
        return (
            request.user 
            and request.user.is_authenticated 
            and getattr(request.user.role, "name", None) in ["tenant_admin", "manager"]
        )


class IsFinanceOrAdmin(permissions.BasePermission):
    """Allow access to FinanceOfficer and TenantAdmin roles."""
    def has_permission(self, request, view):
        return (
            request.user 
            and request.user.is_authenticated 
            and getattr(request.user.role, "name", None) in ["finance_officer", "tenant_admin"]
        )


class IsTenantAdminManagerOrFinance(permissions.BasePermission):
    """Allow access to TenantAdmin, Manager, or FinanceOfficer roles."""
    def has_permission(self, request, view):
        return (
            request.user 
            and request.user.is_authenticated 
            and getattr(request.user.role, "name", None) in ["tenant_admin", "manager", "finance_officer"]
        )

class IsStaffOrTenantAdminManagerOrFinance(permissions.BasePermission):
    """
    Staff can create purchase orders.
    Tenant Admins, Managers, and Finance can view and manage them.
    """

    def has_permission(self, request, view):
        return (
            request.user 
            and request.user.is_authenticated 
            and getattr(request.user.role, "name", None) in ["tenant_admin", "manager", "finance_officer", "staff"]
        )