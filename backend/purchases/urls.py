from rest_framework.routers import DefaultRouter
from .views import PurchaseOrderViewSet

router = DefaultRouter()
router.register(r'purchases', PurchaseOrderViewSet, basename='purchase')

urlpatterns = router.urls
