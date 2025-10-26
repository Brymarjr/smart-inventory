from rest_framework.routers import DefaultRouter
from .views import UserViewSet, UserRoleViewSet, TenantAwareAuthViewSet, UserRoleAssignViewSet

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'user-roles', UserRoleViewSet, basename='user-role')
router.register(r'', TenantAwareAuthViewSet, basename='tenant-login')
router.register(r'users', UserRoleAssignViewSet, basename='user-role-assign')

urlpatterns = router.urls
