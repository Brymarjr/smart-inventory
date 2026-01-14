from rest_framework import permissions

class IsSupportReadOnly(permissions.BasePermission):
    """
    Global permission to restrict Support Staff (is_superuser=True, is_staff=False)
    to Read-Only access across the entire system.
    
    EXCEPTION: They must have write access to the 'support' app to manage tickets.
    """

    def has_permission(self, request, view):
        user = request.user
        
        # 1. If user is not authenticated or not a superuser, this permission doesn't apply.
        # (Other permissions like IsAuthenticated will handle basic access)
        if not user or not user.is_authenticated or not user.is_superuser:
            return True

        # 2. If user is a Full Admin (is_staff=True), let them do anything.
        if user.is_staff:
            return True

        # 3. If we are here, the user is Support Staff (Superuser but NOT Staff).
        
        # EXCEPTION: Allow write access if we are in the 'support' app
        # We check the app_label of the view's queryset model
        if hasattr(view, 'queryset') and view.queryset is not None:
            model_app = view.queryset.model._meta.app_label
            if model_app == 'support':
                return True
        
        # Also check directly if the view belongs to the support module
        if view.__module__.startswith('support.'):
            return True

        # 4. For all other apps (Billing, Tenants, etc.), allow ONLY Safe Methods.
        if request.method in permissions.SAFE_METHODS:
            return True

        # 5. Block write attempts elsewhere
        return False