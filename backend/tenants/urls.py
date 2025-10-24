from rest_framework.routers import DefaultRouter
from .views import TenantRegistrationViewSet

router = DefaultRouter()
router.register(r'tenants/register', TenantRegistrationViewSet, basename='tenant-register')

urlpatterns = router.urls

