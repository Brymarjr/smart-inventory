"""
Thread-local storage for current tenant.
Used by TenantAwareModel manager to filter queries automatically.
"""

import threading


class TenantNotSetError(Exception):
    """Raised when no current tenant is set in thread-local storage."""
    def __init__(self):
        super().__init__(
            "❌ No current tenant is set for this thread.\n"
            "This usually means you are accessing a tenant-aware model outside a tenant context.\n"
            "💡 Fix: Make sure you set the current tenant before performing database operations.\n"
            "Example:\n"
            "    from core.tenant_context import set_current_tenant\n"
            "    set_current_tenant(request.tenant)\n"
        )


_thread_locals = threading.local()


def set_current_tenant(tenant):
    """Assign the current tenant to the current thread."""
    _thread_locals.tenant = tenant


def get_current_tenant():
    """Retrieve the tenant currently bound to this thread, or raise TenantNotSetError."""
    tenant = getattr(_thread_locals, "tenant", None)
    if tenant is None:
        raise TenantNotSetError()
    return tenant


def clear_current_tenant():
    """Clear the tenant from the current thread context."""
    if hasattr(_thread_locals, "tenant"):
        delattr(_thread_locals, "tenant")

