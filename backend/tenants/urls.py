from rest_framework.routers import DefaultRouter
from .views import TenantRegistrationViewSet, TenantSettingsViewSet, AuditLogViewSet

router = DefaultRouter()
router.register(r'tenants/register', TenantRegistrationViewSet, basename='tenant-register')
router.register(r'settings', TenantSettingsViewSet, basename='tenant-settings')
router.register(r'audit-logs', AuditLogViewSet, basename='audit-log')

urlpatterns = router.urls

