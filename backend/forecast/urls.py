from rest_framework.routers import DefaultRouter

from forecast.views import (
    ForecastViewSet,
    ForecastModelViewSet,
)

router = DefaultRouter()
router.register('forecasts', ForecastViewSet, basename='forecast')
router.register('forecast-models', ForecastModelViewSet, basename='forecast-model')

urlpatterns = router.urls
