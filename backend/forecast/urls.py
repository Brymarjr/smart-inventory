from rest_framework.routers import DefaultRouter

from forecast.views import ForecastViewSet

router = DefaultRouter()
router.register('forecasts', ForecastViewSet, basename='forecast')

urlpatterns = router.urls
