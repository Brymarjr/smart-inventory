"""
Sales Views Module.

This module is the heart of the Point of Sale (POS) system. It manages:
1.  **Sale Records:** Storing transaction data when a cashier completes a sale.
2.  **Access Control:** Ensuring Cashiers can only create sales, while Managers
    can view full transaction history.
3.  **Dashboard Analytics:** Providing real-time financial metrics (Revenue, Profit, Trends)
    for the store's "Overview" page.
"""

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
    Manages Sales Transactions and Analytics.

    This ViewSet serves two distinct roles based on the user's role:
    1.  **For Cashiers (Staff):** It is a write-only interface to record new sales (POST).
    2.  **For Managers/Admins:** It is a read-interface to view history (GET) and
        access analytical dashboards.

    Tenant Isolation is enforced strictly via `TenantFilteredViewSet`.
    """

    queryset = (
        Sale.objects.all()
        .select_related("created_by", "tenant")
        .prefetch_related("items__product")
    )
    permission_classes = [IsAuthenticated, MustChangePasswordPermission]
    
    pagination_class = StandardResultsSetPagination
    
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['reference', 'customer_name', 'notes', 'created_by__username', 'created_by__first_name',  # Search by cashier First Name
        'created_by__last_name',   # Search by cashier Last Name
        'items__product__name']  # Search by product name in sale items

    def get_permissions(self):
        """
        Dynamic Permission Assignment:
        - **Create (POST):** Allowed for 'Staff' (Cashiers) and above.
        - **View/List (GET):** Restricted to 'Managers' and 'Tenant Admins' only.
          (Cashiers typically should not see the entire store's financial history).
        """
        if self.action == "create":
            permission_classes = [
                IsAuthenticated,
                IsStaff,
                IsStaffOrTenantAdminManager, # Technically redundant if IsStaff handles it, but ensures safety
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
        """
        Swaps serializers based on action:
        - **Create:** Validates input (IDs, Quantities, Payment Method).
        - **Read:** Returns nested details (Product Names, Usernames).
        """
        return SaleCreateSerializer if self.action == "create" else SaleReadSerializer

    def _get_tenant_or_403(self, request):
        """Helper to safely extract tenant or raise Forbidden."""
        tenant = getattr(request.user, "tenant", None)
        if tenant is None:
            raise PermissionDenied("Tenant context not found.")
        return tenant

    def list(self, request, *args, **kwargs):
        """
        Lists all sales for the current tenant.
        Gated by the 'sales_view' feature flag.
        """
        tenant = self._get_tenant_or_403(request)
        require_feature(tenant, "sales_view")

        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page or queryset, many=True)

        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        """
        Retrieve a specific sale by ID.
        Useful for printing receipts or auditing specific transactions.
        """
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
        """
        Records a new Sale.
        
        This is the most critical endpoint in the system. It:
        1. Validates stock availability.
        2. Deducts inventory.
        3. Records the financial transaction.
        """
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
        Aggregates Real-Time Financial Data for the Admin Dashboard.
        
        Calculates:
        1. **Revenue & Profit:** Compares current month vs. previous month.
        2. **Trends:** Percentage growth/decline.
        3. **Operational Metrics:** Low stock alerts and total product count.
        4. **Top Sellers:** Identify the top 5 performing products this month.
        
        Returns:
            JSON object formatted for frontend KPI cards and charts.
        """
        tenant = self._get_tenant_or_403(request)
        # require_feature(tenant, "ml_forecasting") # Optional: If we decide to gate this feature

        now = timezone.now()
        
        # 1. Date Ranges (First of this month, First of last month)
        start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        last_month_end = start_of_month - timedelta(seconds=1)
        last_month_start = last_month_end.replace(day=1, hour=0, minute=0, second=0)

        # 2. Helper Logic: Calculates Revenue and Profit for a given date range
        def get_financials(start_date, end_date=None):
            filters = {
                'sale__tenant': tenant,
                'sale__created_at__gte': start_date,
            }
            if end_date:
                filters['sale__created_at__lte'] = end_date

            # Aggregate SaleItems for accurate Profit calculation:
            # Profit = Sum(Selling Price - Cost Price) * Quantity
            stats = SaleItem.objects.filter(**filters).aggregate(
                revenue=Sum('subtotal'),
                total_cost=Sum(F('cost_price') * F('quantity'))
            )
            
            rev = stats['revenue'] or 0
            cost = stats['total_cost'] or 0
            profit = rev - cost
            return rev, profit

        # 3. Fetch Data for Current and Previous Periods
        curr_revenue, curr_profit = get_financials(start_of_month)
        prev_revenue, prev_profit = get_financials(last_month_start, last_month_end)

        # 4. Calculate Trends (Percentage Change)
        def calc_trend(current, previous):
            if previous == 0: 
                return 100 if current > 0 else 0
            return round(((current - previous) / previous) * 100, 1)

        # 5. Inventory Health Metrics
        low_stock = Product.objects.filter(
            tenant=tenant, 
            is_deleted=False, 
            quantity__lte=F('reorder_level')
        ).count()
        
        product_count = Product.objects.filter(tenant=tenant, is_deleted=False).count()

        # 6. Top Selling Products (Top 5 by Volume)
        # Groups by product name, sums quantity, and sorts descending
        top_products = SaleItem.objects.filter(
            sale__tenant=tenant,
            sale__created_at__gte=start_of_month # Top products THIS MONTH
        ).values('product__name').annotate(
            total_sold=Sum('quantity'),
            total_revenue=Sum('subtotal')
        ).order_by('-total_sold')[:5]

        # 7. Return Final JSON
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