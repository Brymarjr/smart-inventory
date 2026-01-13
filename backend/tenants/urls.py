from rest_framework.routers import DefaultRouter
from .views import TenantRegistrationViewSet, TenantSettingsViewSet, AuditLogViewSet, SystemAdminTenantViewSet, SystemAdminStatsViewSet

router = DefaultRouter()
router.register(r'tenants/register', TenantRegistrationViewSet, basename='tenant-register')
router.register(r'settings', TenantSettingsViewSet, basename='tenant-settings')
router.register(r'audit-logs', AuditLogViewSet, basename='audit-log')
router.register(r'admin/tenants', SystemAdminTenantViewSet, basename='admin-tenants')
router.register(r'admin/stats', SystemAdminStatsViewSet, basename='admin-stats')

urlpatterns = router.urls

