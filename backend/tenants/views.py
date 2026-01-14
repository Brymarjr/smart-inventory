"""
Tenants Views Module.

This module is responsible for the core Multi-Tenancy logic. It handles:
1.  **Onboarding:** Public registration of new organizations (`TenantRegistrationViewSet`).
2.  **Configuration:** Managing per-tenant settings like alerts and localization (`TenantSettingsViewSet`).
3.  **Security:** Providing audit trails for sensitive actions (`AuditLogViewSet`).
4.  **Platform Administration:** "God Mode" views for system admins to manage the entire SaaS platform (`SystemAdminTenantViewSet`).
"""

import csv
from django.http import HttpResponse
from rest_framework import status, viewsets, filters
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import action
from .serializers import TenantDetailSerializer, TenantRegistrationSerializer, TenantSettingsSerializer, AuditLogSerializer, TenantListSerializer
from .models import Tenant, TenantSettings, AuditLog
from core.pagination import StandardResultsSetPagination
from core.mixins import TenantFilteredViewSet
from users.permissions import IsTenantAdminOrManager
from core.permissions import IsSupportReadOnly


class TenantRegistrationViewSet(viewsets.ViewSet):
    """
    Public Endpoint for New Organization Sign-up.

    This ViewSet handles the initial onboarding process:
    1.  Validates the company name and subdomain (slug).
    2.  Creates the Tenant record.
    3.  Creates the initial Admin User for that Tenant.
    """
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
    """
    Manages Configuration for the Current Tenant.

    Handles settings such as:
    - Low stock alert thresholds.
    - Currency and Localization preferences.
    - Feature toggles.
    """
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """
        GET /api/settings/
        Returns the settings for the current tenant.
        
        Logic:
        - Implicitly uses `request.tenant` (via middleware).
        - Uses `get_or_create` to ensure a settings object always exists, 
          even if it's the first time the user visits the settings page.
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
        Updates specific settings fields.
        
        Uses `partial=True` to allow updating single fields (e.g., toggling a switch)
        without sending the entire settings payload.
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
    Tenant Administrator View for Security Logs.
    
    Allows Tenant Admins/Managers to see WHO did WHAT inside their specific store.
    
    Features:
    - **Read-Only:** Logs cannot be deleted or modified to preserve integrity.
    - **Searchable:** Filter by Actor (User), Action (Update/Delete), or Target (Product Name).
    - **Exportable:** Download logs as CSV for external compliance reporting.
    """
    queryset = AuditLog.objects.all().order_by('-timestamp')
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated, IsSupportReadOnly | IsTenantAdminOrManager] 
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
        Generates a CSV file of the currently filtered logs.
        
        Useful for managers who need to report to store owners or external auditors.
        """
        queryset = self.filter_queryset(self.get_queryset())

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="audit_logs.csv"'

        writer = csv.writer(response)
        # Header Row
        writer.writerow(['Timestamp', 'Actor Name', 'Actor Email', 'Action', 'Target Model', 'Target Name', 'Reason'])

        # Data Rows
        for log in queryset:
            # Strip the tenant prefix (e.g., "1__admin" -> "admin") so the report looks clean
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
    
    
class SystemAdminTenantViewSet(viewsets.ModelViewSet):
    """
    [SYSTEM ADMIN ONLY] Platform Management ViewSet.
    
    This view allows Superusers/Support Staff to oversee all Tenants on the platform.
    
    Capabilities:
    - **Global Visibility:** View all registered organizations.
    - **Moderation:** Suspend/Activate tenants (e.g., for non-payment or abuse).
    - **Deep Inspection:** View audit logs for a specific tenant to help debug issues.
    """
    queryset = Tenant.objects.all().order_by('-created_at')
    permission_classes = [IsSupportReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'slug']

    def get_serializer_class(self):
        #  If fetching ONE tenant (e.g. /api/admin/tenants/5/), use Detail logic
        #  (Includes more heavy data)
        if self.action == 'retrieve':
            return TenantDetailSerializer
        #  If fetching ALL tenants (e.g. /api/admin/tenants/), use List logic
        #  (Lightweight, just names and status)
        return TenantListSerializer

    # Action to Suspend/Activate Tenant
    @action(detail=True, methods=['post'])
    def toggle_status(self, request, pk=None):
        """
        Toggles a Tenant's active status.
        
        - **Active:** Tenant can login and use the system.
        - **Suspended (Inactive):** API access is blocked for all users in this tenant.
        """
        tenant = self.get_object()
        tenant.is_active = not tenant.is_active
        tenant.save()
        return Response({
            "status": "Active" if tenant.is_active else "Suspended", 
            "is_active": tenant.is_active
        })
        
    # Fetch Audit Logs for this specific Tenant
    @action(detail=True, methods=['get'])
    def audit_logs(self, request, pk=None):
        """
        Allows System Admins to peek into a specific Tenant's audit logs.
        
        Useful for Support Staff when a customer claims "Data disappeared" 
        and we need to verify if someone deleted it.
        """
        tenant = self.get_object()
        
        # Get logs for this tenant, newest first
        logs = AuditLog.objects.filter(tenant=tenant).order_by('-timestamp')
        
        # Apply standard pagination (so we don't crash if they have 10,000 logs)
        page = self.paginate_queryset(logs)
        if page is not None:
            serializer = AuditLogSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = AuditLogSerializer(logs, many=True)
        return Response(serializer.data)
    
    
class SystemAdminStatsViewSet(viewsets.ViewSet):
    """
    [SYSTEM ADMIN ONLY] Global Dashboard Stats.
    
    Provides high-level metrics for the Platform Admin Dashboard cards.
    """
    permission_classes = [IsSupportReadOnly]

    def list(self, request):
        total = Tenant.objects.count()
        active = Tenant.objects.filter(is_active=True).count()
        inactive = Tenant.objects.filter(is_active=False).count()
        
        return Response({
            "total": total,
            "active": active,
            "inactive": inactive
        })