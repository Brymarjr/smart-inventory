from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import BasePermission
from django.db.models import Sum
from django.db.models.functions import TruncMonth
from django.db import connection
from django.utils import timezone
from dateutil.relativedelta import relativedelta
from django_redis import get_redis_connection
import datetime
import logging

from .models import Tenant
from sales.models import Sale
from support.models import Ticket

logger = logging.getLogger(__name__)

class IsAnySuperUser(BasePermission):
    """
    Allows access to ANY user marked as 'superuser'.
    This covers:
    1. Superusers with is_staff=True
    2. Superusers with is_staff=False
    """
    def has_permission(self, request, view):
        # We only care if 'is_superuser' is True. We ignore 'is_staff'.
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)

class SystemAnalyticsView(APIView):
    """
    Returns REAL global stats including calculated Growth Rate and live System Health pings.
    """
    permission_classes = [IsAnySuperUser]

    def get(self, request):
        # --- 1. AGGREGATE STATS ---
        total_tenants = Tenant.objects.count()
        active_tenants = Tenant.objects.filter(is_active=True).count()
        
        # Calculate Global Revenue (Handle None if no sales exist)
        global_revenue = Sale.objects.aggregate(Sum('total_amount'))['total_amount__sum'] or 0
        
        open_tickets = Ticket.objects.exclude(status='closed').count()

        # --- 2. GROWTH RATE (Month over Month) ---
        now = timezone.now()
        # Get the first day of THIS month
        start_of_this_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        # Get the first day of LAST month
        start_of_last_month = start_of_this_month - relativedelta(months=1)
        
        # Efficient DB Counts
        new_tenants_this_month = Tenant.objects.filter(created_at__gte=start_of_this_month).count()
        new_tenants_last_month = Tenant.objects.filter(
            created_at__gte=start_of_last_month, 
            created_at__lt=start_of_this_month
        ).count()

        # Safe Division Calculation
        if new_tenants_last_month > 0:
            growth_rate = ((new_tenants_this_month - new_tenants_last_month) / new_tenants_last_month) * 100
        else:
            # If 0 last month, and we have new ones this month, it's 100% growth.
            # If 0 last month and 0 this month, it's 0% growth.
            growth_rate = 100.0 if new_tenants_this_month > 0 else 0.0

        # --- 3. SYSTEM HEALTH CHECKS ---
        health_status = {
            "database": "Offline",
            "redis": "Offline",
            "api": "Online" # If this code executes, API is reachable
        }

        # A. Check Database (PostgreSQL)
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                health_status["database"] = "Online"
        except Exception as e:
            logger.error(f"Database Health Check Failed: {e}")
            health_status["database"] = "Offline"

        # B. Check Task Queue (Redis)
        try:
            # Uses the 'default' cache connection defined in settings.py
            conn = get_redis_connection("default")
            # .ping() returns True if connected
            if conn.ping():
                health_status["redis"] = "Online"
        except Exception as e:
            # It's common for Redis to be unavailable in some dev environments
            # We log it but don't crash the dashboard
            logger.warning(f"Redis Health Check Failed: {e}")
            health_status["redis"] = "Offline"

        # --- 4. REVENUE GRAPH (Last 6 Months) ---
        six_months_ago = now.date() - datetime.timedelta(days=180)
        
        revenue_data = (
            Sale.objects
            .filter(created_at__gte=six_months_ago)
            .annotate(month=TruncMonth('created_at'))
            .values('month')
            .annotate(total=Sum('total_amount'))
            .order_by('month')
        )

        formatted_graph = [
            {
                "name": item['month'].strftime("%b"), 
                "total": item['total']
            }
            for item in revenue_data
        ]

        # --- 5. RETURN RESPONSE ---
        return Response({
            "total_tenants": total_tenants,
            "active_tenants": active_tenants,
            "global_revenue": global_revenue,
            "open_tickets": open_tickets,
            "growth_rate": round(growth_rate, 1),
            "health": health_status,
            "graph_data": formatted_graph
        })