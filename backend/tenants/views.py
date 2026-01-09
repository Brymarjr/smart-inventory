from rest_framework import status, viewsets
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from .serializers import TenantRegistrationSerializer, TenantSettingsSerializer
from .models import TenantSettings

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