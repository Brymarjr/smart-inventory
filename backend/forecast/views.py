from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAdminUser
from rest_framework import filters
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone

from core.mixins import TenantFilteredViewSet 
from core.pagination import StandardResultsSetPagination 
from .models import Forecast, InventoryAnomaly, ForecastModel
from .serializers import ForecastDashboardSerializer, InventoryAnomalySerializer
from .tasks import run_analytics_for_all, train_and_detect_anomalies, generate_daily_forecasts
from billing.utils import require_feature
from tenants.models import Tenant

class ForecastViewSet(TenantFilteredViewSet):
    """
    Read-Only ViewSet for Intelligence Data.
    """
    queryset = Forecast.objects.all()
    serializer_class = ForecastDashboardSerializer
    http_method_names = ['get']
    
    pagination_class = StandardResultsSetPagination
    
    # 🔍 Added search capability to match your Sales views
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['product__name', 'product__sku']
    ordering_fields = ['prediction_date', 'product__name']

    def get_queryset(self):
        """
        Base queryset: Automatically paginated by DRF.
        Optimized with select_related to prevent N+1 queries.
        """
        qs = super().get_queryset().select_related('product')
        
        # Allow frontend to filter by specific date if needed (e.g., ?prediction_date=2026-03-18)
        target_date = self.request.query_params.get('prediction_date')
        if target_date:
            qs = qs.filter(prediction_date=target_date)
            
        return qs.order_by('prediction_date', 'product__name')

    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        """
        The Main Intelligence Dashboard Summary.
        Returns top-level KPIs and urgent alerts. 
        """
        tenant = request.user.tenant
        require_feature(tenant, 'ml_forecasting')
        
        # 1. Summary Metrics
        stats = InventoryAnomaly.objects.filter(tenant=tenant, is_resolved=False).aggregate(
            total_alerts=Count('id'),
            critical_alerts=Count('id', filter=Q(severity='high')),
            velocity_spikes=Count('id', filter=Q(anomaly_type='velocity_spike')),
            ghost_stock=Count('id', filter=Q(anomaly_type='shrinkage')),
        )

        # 2. Anomalies (Active alerts only)
        anomalies = InventoryAnomaly.objects.filter(
            tenant=tenant, is_resolved=False
        ).select_related('product').order_by('-severity', '-detected_at')
        
        return Response({
            "summary": stats,
            "alerts": InventoryAnomalySerializer(anomalies, many=True).data
        })

    @action(detail=False, methods=['get'])
    def product_chart(self, request):
        """
        Returns the full 7-day forecast timeline for a specific product.
        Usage: GET /api/forecasts/product_chart/?product_id=123
        """
        product_id = request.query_params.get('product_id')
        if not product_id:
            return Response({"detail": "product_id parameter is required."}, status=400)
            
        tenant = request.user.tenant
        today = timezone.now().date()
        
        # Grab the next 7 days for this specific product
        forecasts = Forecast.objects.filter(
            tenant=tenant, 
            product_id=product_id,
            prediction_date__gt=today
        ).select_related('product').order_by('prediction_date')[:7]
        
        return Response({
            "product_id": product_id,
            "timeline": ForecastDashboardSerializer(forecasts, many=True).data
        })
        
        
class TrainModelsView(APIView):
    """
    Manual Trigger for the AI Forecasting Engine.
    """
    permission_classes = [IsAdminUser]

    def post(self, request):
        print("🧠 [System Admin] Manually triggering global forecast training...")
        run_analytics_for_all.delay(sync=False)
        return Response({
            "status": "success", 
            "message": "Global Forecast & Anomaly Detection triggered successfully."
        })
        
        
class TrainSingleTenantView(APIView):
    """
    Trigger AI training for a SPECIFIC tenant only.
    """
    permission_classes = [IsAdminUser]
    
    def get(self, request, tenant_id):
        tenant = get_object_or_404(Tenant, id=tenant_id)
        latest_model = ForecastModel.objects.filter(
            tenant=tenant, 
            model_type='evolutionary_v1'
        ).first()
        
        return Response({
            "tenant": tenant.name,
            "last_trained_at": latest_model.trained_at if latest_model else None 
        })

    def post(self, request, tenant_id):
        tenant = get_object_or_404(Tenant, id=tenant_id)
        print(f"🧠 [System Admin] Training model for: {tenant.name}...")
        
        train_and_detect_anomalies.delay(tenant.id)
        generate_daily_forecasts.delay(tenant.id)
        
        return Response({
            "status": "success", 
            "message": f"Training started for {tenant.name}."
        })