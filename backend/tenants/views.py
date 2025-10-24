from rest_framework import status, viewsets
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from .serializers import TenantRegistrationSerializer

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
