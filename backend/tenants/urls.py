from rest_framework.routers import DefaultRouter
from .views import TenantRegistrationViewSet, TenantSettingsViewSet

router = DefaultRouter()
router.register(r'tenants/register', TenantRegistrationViewSet, basename='tenant-register')
router.register(r'settings', TenantSettingsViewSet, basename='tenant-settings')

urlpatterns = router.urls

