from django.http import HttpResponseForbidden, JsonResponse
from tenants.models import Tenant
from core import tenant_context
from django.utils import timezone

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
    """Restricts write operations for tenants with expired/inactive subscriptions."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        print(f"🔍 BlockWriteIfSubscriptionExpiredMiddleware triggered: {request.path} {request.method}")

        # Allow safe methods and Paystack webhook
        if request.method in ("GET", "HEAD", "OPTIONS") or request.path.startswith("/api/billing/paystack/webhook/"):
            return self.get_response(request)

        tenant = getattr(request, "tenant", None)
        user = getattr(request, "user", None)

        # Fallback if tenant not directly set on request
        if not tenant and user and hasattr(user, "tenant"):
            tenant = getattr(user, "tenant", None)

        print("➡️ Tenant found:", bool(tenant))
        if tenant:
            from billing.models import Subscription

            try:
                sub = Subscription.objects.filter(tenant=tenant).order_by("-created_at").first()
            except Exception:
                sub = None

            if not sub:
                return JsonResponse(
                    {"detail": "No subscription found for this tenant. Please subscribe to continue."},
                    status=403,
                )

            now = timezone.now()
            active = sub.status == "active" and sub.expires_at > now

            print(f"📅 Subscription check → plan={sub.plan.name}, active={active}")

            if not active:
                # Free plan expired
                if sub.plan.name.lower() == "free":
                    msg = "Your free trial has expired. Please upgrade to a Pro or Enterprise plan to continue using the system."
                else:
                    msg = f"Your {sub.plan.name} plan subscription has expired. Please renew to regain write access."

                print("🚫 Blocking write for expired tenant:", tenant)
                return JsonResponse({"detail": msg}, status=403)

        return self.get_response(request)



