"""
Forecast & Intelligence Views.

This module powers the "AI Dashboard". It aggregates data from the Machine Learning
models (Forecasts) and the Anomaly Detection engine (Alerts) to provide actionable
insights to the store manager.
"""

import csv
from django.http import HttpResponse
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAdminUser

from core.mixins import TenantFilteredViewSet 
from core.pagination import StandardResultsSetPagination
from .models import Forecast, InventoryAnomaly, ForecastModel
from .serializers import ForecastDashboardSerializer, InventoryAnomalySerializer
from .tasks import run_analytics_for_all, train_and_detect_anomalies, generate_daily_forecasts
from .reports import get_monthly_metrics
from billing.utils import require_feature
from tenants.models import Tenant

class ForecastViewSet(TenantFilteredViewSet):
    """
    Read-Only ViewSet for Intelligence Data.
    """
    queryset = Forecast.objects.all()
    serializer_class = ForecastDashboardSerializer
    http_method_names = ['get']
    
    # Standard Pagination for the main forecast table
    pagination_class = StandardResultsSetPagination
    
    # Search and Ordering filters
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['product__name', 'product__sku']
    ordering_fields = ['prediction_date', 'product__name']

    def get_queryset(self):
        """
        Base queryset optimized for the paginated table.
        """
        qs = super().get_queryset().select_related('product')
        
        # Filter by date if provided (e.g., from the frontend dashboard)
        target_date = self.request.query_params.get('prediction_date')
        if target_date:
            qs = qs.filter(prediction_date=target_date)
            
        return qs.order_by('prediction_date', 'product__name')

    @action(detail=False, methods=['get'], pagination_class=None)
    def dashboard(self, request):
        """
        The Main Intelligence Dashboard Summary.
        Returns top-level KPIs and urgent alerts.
        Isolated from pagination to prevent frontend mapping crashes.
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

        # 3. Forecasts (Limit to top 20 for initial dashboard load)
        forecasts = Forecast.objects.filter(tenant=tenant).select_related('product').order_by('prediction_date')[:20]
        
        return Response({
            "summary": stats,
            "alerts": InventoryAnomalySerializer(anomalies, many=True).data,
            "forecasts": ForecastDashboardSerializer(forecasts, many=True).data
        })

    @action(detail=False, methods=['get'])
    def product_chart(self, request):
        """
        Returns the full 7-day forecast timeline for a specific product.
        """
        product_id = request.query_params.get('product_id')
        if not product_id:
            return Response({"detail": "product_id parameter is required."}, status=400)
            
        tenant = request.user.tenant
        today = timezone.now().date()
        
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
    Manual Trigger for the AI Forecasting Engine (Platform Wide).
    """
    permission_classes = [IsAdminUser]

    def post(self, request):
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
        train_and_detect_anomalies.delay(tenant.id)
        generate_daily_forecasts.delay(tenant.id)
        return Response({
            "status": "success", 
            "message": f"Training started for {tenant.name}."
        })

class GlobalMonthlyReportView(APIView):
    """
    Endpoint for System Admins to download a platform-wide CSV.
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="platform_monthly_performance.csv"'
        
        writer = csv.writer(response)
        writer.writerow(['Tenant Name', 'Reporting Period', 'Total Revenue', 'Total Profit', 'Net Margin (%)', 'Top Selling Product', 'Anomalies Detected'])

        for tenant in Tenant.objects.all():
            try:
                data = get_monthly_metrics(tenant)
                writer.writerow([
                    data['tenant_name'], 
                    data['period'], 
                    f"{data['revenue']:.2f}", 
                    f"{data['profit']:.2f}", 
                    f"{data['margin']}%", 
                    data['top_product'], 
                    data['anomalies_flagged']
                ])
            except Exception:
                writer.writerow([tenant.name, "No Data", 0, 0, 0, "N/A", 0])

        return response

class AdminPlatformStatsView(APIView):
    """
    Provides aggregate chart data for the System Admin Dashboard.
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        tenants = Tenant.objects.all()
        platform_stats = []
        
        for tenant in tenants:
            try:
                stats = get_monthly_metrics(tenant)
                platform_stats.append({
                    "name": stats['tenant_name'],
                    "id": stats['tenant_id'],
                    "revenue": float(stats['revenue']),
                    "profit": float(stats['profit']),
                    "alerts": stats['anomalies_flagged']
                })
            except Exception:
                continue
            
        return Response({
            "total_tenants": tenants.count(),
            "monthly_breakdown": platform_stats
        })