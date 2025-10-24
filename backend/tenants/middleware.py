from django.http import HttpResponseForbidden
from tenants.models import Tenant
from core import tenant_context

class TenantMiddleware:
    """
    Resolve the current tenant for each request.

    Resolution order:
    1) X-Tenant header (preferred for API calls)
    2) Authenticated user's tenant (fallback, filled later by TenantAttachAfterJWTMiddleware)
    3) None (public route)

    Stores the tenant on:
    - request.tenant
    - core.tenant_context.set_current_tenant(...)
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        tenant = None

        # 1️⃣ Try header first
        tenant_header = request.headers.get("X-Tenant") or request.META.get("HTTP_X_TENANT")
        if tenant_header:
            try:
                tenant = Tenant.objects.get(slug=tenant_header)
                print(f"✅ TenantMiddleware: resolved from header → {tenant.slug}")
            except Tenant.DoesNotExist:
                return HttpResponseForbidden("Invalid tenant")

        # (Fallback happens later if user is known)
        request.tenant = tenant
        tenant_context.set_current_tenant(tenant)

        response = self.get_response(request)

        # Clear thread-local tenant after response
        tenant_context.clear_current_tenant()
        return response






class BlockWriteIfSubscriptionExpiredMiddleware:
    """Globally restricts writes for tenants with expired/inactive subscriptions."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        print(f"🔍 BlockWriteIfSubscriptionExpiredMiddleware triggered: {request.path} {request.method}")

        if request.method in ("GET", "HEAD", "OPTIONS") or request.path.startswith("/api/billing/paystack/webhook/"):
            return self.get_response(request)

        tenant = getattr(request, "tenant", None)
        user = getattr(request, "user", None)

        if not tenant and user and hasattr(user, "tenant"):
            tenant = getattr(user, "tenant", None)

        print("➡️  Tenant found:", bool(tenant))
        if tenant:
            from billing.models import Subscription
            from django.utils import timezone

            active = Subscription.objects.filter(
                tenant=tenant,
                status="active",
                expires_at__gt=timezone.now(),
            ).exists()

            print(f"📅 Subscription check → active={active}")

            if not active:
                print("🚫 Blocking write for expired tenant:", tenant)
                from django.http import JsonResponse
                return JsonResponse(
                    {"detail": "Your tenant's subscription has expired. You have read-only access until renewal."},
                    status=403,
                )

        return self.get_response(request)


