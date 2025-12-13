from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from core.mixins import TenantFilteredViewSet
from users.permissions import IsTenantAdmin

from forecast.models import Forecast, ForecastModel
from forecast.serializers import (
    ForecastDashboardSerializer,
    ForecastModelSerializer,
)
from forecast.tasks import (
    train_model_for_tenant,
    generate_forecast_for_tenant,
)

class ForecastViewSet(TenantFilteredViewSet):
    """
    Read-only access to generated forecasts in dashboard format.
    """
    queryset = Forecast.objects.all()
    serializer_class = ForecastDashboardSerializer
    http_method_names = ['get']

    @action(detail=False, methods=['get'], url_path='dashboard')
    def dashboard(self, request):
        """
        Returns forecast dashboard for tenant, including last sale date and suggested actions.
        """
        tenant = request.user.tenant
        if not tenant:
            return Response(
                {"detail": "Superuser or user without tenant cannot access tenant dashboard."},
                status=400
            )
        
        forecasts = Forecast.objects.filter(tenant=tenant).order_by('prediction_date')
        serializer = self.get_serializer(forecasts, many=True)
        return Response(serializer.data)


class ForecastModelViewSet(TenantFilteredViewSet):
    """
    View trained ML models and trigger retraining.
    """
    queryset = ForecastModel.objects.all()
    serializer_class = ForecastModelSerializer
    permission_classes = [IsTenantAdmin]
    http_method_names = ['get', 'post']

    @action(detail=False, methods=['post'], url_path='train')
    def train(self, request):
        tenant_id = request.user.tenant_id
        train_model_for_tenant.delay(tenant_id)
        return Response({"status": "model_training_started"}, status=status.HTTP_202_ACCEPTED)

    @action(detail=False, methods=['post'], url_path='generate')
    def generate(self, request):
        tenant_id = request.user.tenant_id
        generate_forecast_for_tenant.delay(tenant_id)
        return Response({"status": "forecast_generation_started"}, status=status.HTTP_202_ACCEPTED)
