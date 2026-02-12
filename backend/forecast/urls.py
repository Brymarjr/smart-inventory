from rest_framework.routers import DefaultRouter
from django.urls import path
from forecast.views import ForecastViewSet, TrainModelsView

router = DefaultRouter()
router.register('forecasts', ForecastViewSet, basename='forecast')

urlpatterns = router.urls + [
    path('admin/train-models/', TrainModelsView.as_view(), name='train-models'),
]
