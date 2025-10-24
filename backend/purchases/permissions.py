from rest_framework import permissions

class IsTenantAdminOrStaff(permissions.BasePermission):
    """
    Allow only users who are staff for their tenant (is_staff True) or superusers.
    Superusers without tenant are allowed as global admins.
    """

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        # Global superuser allowed
        if user.is_superuser and not getattr(user, "tenant", None):
            return True
        # Tenant staff/admin allowed
        return bool(getattr(user, "tenant", None) and (user.is_staff or user.is_superuser))


class CanCreatePurchase(permissions.BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.has_perm("purchases.add_purchaseorder"))


class CanApprovePurchase(permissions.BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.has_perm("purchases.approve_purchaseorder"))


class CanMarkPaidPurchase(permissions.BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.has_perm("purchases.mark_paid_purchaseorder"))
