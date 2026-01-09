import csv
from django.http import HttpResponse
from rest_framework import status, viewsets, filters
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import action
from .serializers import TenantRegistrationSerializer, TenantSettingsSerializer, AuditLogSerializer
from .models import TenantSettings, AuditLog
from core.pagination import StandardResultsSetPagination
from core.mixins import TenantFilteredViewSet
from users.permissions import IsTenantAdminOrManager

class TenantRegistrationViewSet(viewsets.ViewSet):
    permission_classes = [AllowAny]
    serializer_class = TenantRegistrationSerializer

    def create(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = serializer.save()

        return Response({
            "message": "Tenant and admin user created successfully.",
            "tenant": result["tenant"].name,
            "admin_user": result["admin_user"].username,
        }, status=status.HTTP_201_CREATED)


class TenantSettingsViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """
        GET /api/settings/
        Returns the settings for the current tenant.
        Creates default settings if they don't exist yet.
        """
        # 1. Get the tenant from the request (middleware handles this)
        tenant = request.tenant 
        
        # 2. Get or Create the settings object
        settings, created = TenantSettings.objects.get_or_create(tenant=tenant)
        
        # 3. Serialize and return
        serializer = TenantSettingsSerializer(settings)
        return Response(serializer.data)

    def create(self, request):
        """
        POST /api/settings/
        Updates the settings for the current tenant.
        """
        tenant = request.tenant
        settings, _ = TenantSettings.objects.get_or_create(tenant=tenant)
        
        # Use 'partial=True' so we can update just one field (e.g. just the toggle)
        serializer = TenantSettingsSerializer(settings, data=request.data, partial=True)
        
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    
class AuditLogViewSet(TenantFilteredViewSet):
    """
    Read-only view of audit logs.
    Only accessible by Tenant Admins and Managers.
    """
    queryset = AuditLog.objects.all().order_by('-timestamp')
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated, IsTenantAdminOrManager] 
    pagination_class = StandardResultsSetPagination
    
    # ENABLE SEARCH
    filter_backends = [filters.SearchFilter]
    search_fields = [
        'actor__username', 
        'actor__email', 
        'target_name',     # Search by Product/Category Name
        'target_model',    # Search by "Category" or "Supplier"
        'reason',          # Search inside the reason text
        'action'           # Search "DELETE" or "UPDATE"
    ]
    
    @action(detail=False, methods=['get'])
    def export_csv(self, request):
        """
        Exports the filtered audit logs to a CSV file.
        """
        queryset = self.filter_queryset(self.get_queryset())

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="audit_logs.csv"'

        writer = csv.writer(response)
        # Header Row
        writer.writerow(['Timestamp', 'Actor Name', 'Actor Email', 'Action', 'Target Model', 'Target Name', 'Reason'])

        # Data Rows
        for log in queryset:
            # Strip the tenant prefix (e.g., "1__admin" -> "admin")
            raw_username = log.actor.username if log.actor else 'System'
            clean_username = raw_username.split('__')[-1] if '__' in raw_username else raw_username

            writer.writerow([
                log.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                clean_username, # Use the clean name
                log.actor.email if log.actor else '',
                log.action,
                log.target_model,
                log.target_name,
                log.reason
            ])

        return response