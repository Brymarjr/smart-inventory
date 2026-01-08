from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Count, Q
from core.mixins import TenantFilteredViewSet 
from .models import Forecast, InventoryAnomaly
from .serializers import ForecastDashboardSerializer, InventoryAnomalySerializer

class ForecastViewSet(TenantFilteredViewSet):
    queryset = Forecast.objects.all()
    serializer_class = ForecastDashboardSerializer
    http_method_names = ['get']

    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        """
        Main Intelligence Dashboard
        Returns: Summary Counts, Top Forecasts, and Active Alerts
        """
        tenant = request.user.tenant
        
        # 1. Summary Metrics (For the top cards)
        # We count alerts by severity
        stats = InventoryAnomaly.objects.filter(tenant=tenant, is_resolved=False).aggregate(
            total_alerts=Count('id'),
            critical_alerts=Count('id', filter=Q(severity='high')),
            velocity_spikes=Count('id', filter=Q(anomaly_type='velocity_spike')),
            ghost_stock=Count('id', filter=Q(anomaly_type='shrinkage')),
        )

        # 2. Forecasts (Next 7 days for top items)
        forecasts = Forecast.objects.filter(tenant=tenant).select_related('product').order_by('prediction_date')[:50]
        
        # 3. Anomalies (Active alerts only)
        anomalies = InventoryAnomaly.objects.filter(tenant=tenant, is_resolved=False).select_related('product').order_by('-severity', '-detected_at')
        
        return Response({
            "summary": stats,  # <--- Added this block
            "forecasts": ForecastDashboardSerializer(forecasts, many=True).data,
            "alerts": InventoryAnomalySerializer(anomalies, many=True).data
        })