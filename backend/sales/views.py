from datetime import timedelta
from django.utils import timezone
from django.db.models import Sum, F
from rest_framework.decorators import action
from rest_framework import status, filters
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from core.mixins import TenantFilteredViewSet
from users.permissions import (
    IsStaff,
    IsStaffOrTenantAdminManager,
    MustChangePasswordPermission,
)
from .models import Sale, SaleItem
from .serializers import SaleCreateSerializer, SaleReadSerializer
from billing.utils import require_feature
from inventory.models import Product
from core.pagination import StandardResultsSetPagination


class SaleViewSet(TenantFilteredViewSet):
    """
    Handles sales creation (by staff) and viewing (by admins, managers, finance).
    Uses TenantFilteredViewSet to ensure all queries are scoped to request.user.tenant.
    """

    queryset = (
        Sale.objects.all()
        .select_related("created_by", "tenant")
        .prefetch_related("items__product")
    )
    permission_classes = [IsAuthenticated, MustChangePasswordPermission]
    
    pagination_class = StandardResultsSetPagination
    
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['reference', 'customer_name', 'notes', 'created_by__username']

    def get_permissions(self):
        if self.action == "create":
            permission_classes = [
                IsAuthenticated,
                IsStaff,
                MustChangePasswordPermission,
            ]
        else:
            permission_classes = [
                IsAuthenticated,
                IsStaffOrTenantAdminManager,
                MustChangePasswordPermission,
            ]
        return [perm() for perm in permission_classes]

    def get_serializer_class(self):
        return SaleCreateSerializer if self.action == "create" else SaleReadSerializer

    def _get_tenant_or_403(self, request):
        tenant = getattr(request.user, "tenant", None)
        if tenant is None:
            raise PermissionDenied("Tenant context not found.")
        return tenant

    def list(self, request, *args, **kwargs):
        tenant = self._get_tenant_or_403(request)
        require_feature(tenant, "sales_view")

        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page or queryset, many=True)

        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        tenant = self._get_tenant_or_403(request)
        require_feature(tenant, "sales_view")

        sale = self.get_queryset().filter(pk=pk).first()
        if not sale:
            return Response(
                {"detail": "Sale not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = self.get_serializer(sale)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        tenant = self._get_tenant_or_403(request)
        require_feature(tenant, "sales_view")

        serializer = SaleCreateSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)

        sale = serializer.save(
            tenant=tenant,
            created_by=request.user,
        )

        read_serializer = SaleReadSerializer(
            sale,
            context={"request": request},
        )
        return Response(
            read_serializer.data,
            status=status.HTTP_201_CREATED,
        )
        
    # ==========================================================
    # DASHBOARD STATS ACTION 
    # ==========================================================
    @action(detail=False, methods=['get'], url_path='dashboard-stats')
    def dashboard_stats(self, request):
        """
        Returns aggregated stats for the dashboard:
        - Revenue (Current vs Last Month)
        - Profit (Current vs Last Month)
        - Low Stock Count
        """
        tenant = self._get_tenant_or_403(request)
        # require_feature(tenant, "ml_forecasting") # Optional: If we decide to gate this feature

        now = timezone.now()
        
        # 1. Date Ranges
        start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        last_month_end = start_of_month - timedelta(seconds=1)
        last_month_start = last_month_end.replace(day=1, hour=0, minute=0, second=0)

        # 2. Helper Logic
        def get_financials(start_date, end_date=None):
            filters = {
                'sale__tenant': tenant,
                'sale__created_at__gte': start_date,
            }
            if end_date:
                filters['sale__created_at__lte'] = end_date

            # Aggregate SaleItems for accurate Profit (Price - Cost)
            stats = SaleItem.objects.filter(**filters).aggregate(
                revenue=Sum('subtotal'),
                total_cost=Sum(F('cost_price') * F('quantity'))
            )
            
            rev = stats['revenue'] or 0
            cost = stats['total_cost'] or 0
            profit = rev - cost
            return rev, profit

        # 3. Fetch Data
        curr_revenue, curr_profit = get_financials(start_of_month)
        prev_revenue, prev_profit = get_financials(last_month_start, last_month_end)

        # 4. Calculate Trends
        def calc_trend(current, previous):
            if previous == 0: 
                return 100 if current > 0 else 0
            return round(((current - previous) / previous) * 100, 1)

        # 5. Low Stock & Product Count
        low_stock = Product.objects.filter(
            tenant=tenant, 
            is_deleted=False, 
            quantity__lte=F('reorder_level')
        ).count()
        
        product_count = Product.objects.filter(tenant=tenant, is_deleted=False).count()

        # 6. Top Selling Products (Top 5)
        # Group by product name, sum the quantity, order by highest first
        top_products = SaleItem.objects.filter(
            sale__tenant=tenant,
            sale__created_at__gte=start_of_month # Top products THIS MONTH
        ).values('product__name').annotate(
            total_sold=Sum('quantity'),
            total_revenue=Sum('subtotal')
        ).order_by('-total_sold')[:5]

        # 7. Return Response
        return Response({
            "revenue": { 
                "value": curr_revenue, 
                "trend": calc_trend(curr_revenue, prev_revenue) 
            },
            "profit":  { 
                "value": curr_profit,  
                "trend": calc_trend(curr_profit, prev_profit) 
            },
            "low_stock": low_stock,
            "product_count": product_count,
            "top_products": top_products, 
            "layout_config": getattr(request.user, 'dashboard_config', ["revenue", "profit", "low_stock", "product_count"])
        })
