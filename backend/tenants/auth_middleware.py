from django.utils.deprecation import MiddlewareMixin

class TenantAttachAfterJWTMiddleware(MiddlewareMixin):
    """
    Ensures request.tenant is set after JWT authentication.

    Used when frontend does not send the X-Tenant header.
    """

    def process_request(self, request):
        if not getattr(request, "tenant", None):
            user = getattr(request, "user", None)
            if user and getattr(user, "is_authenticated", False) and hasattr(user, "tenant"):
                request.tenant = getattr(user, "tenant", None)
                if request.tenant:
                    print(f"✅ TenantAttachAfterJWTMiddleware: resolved from user → {request.tenant.slug}")
