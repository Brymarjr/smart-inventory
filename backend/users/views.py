from rest_framework import viewsets, permissions, status, mixins
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.contrib.auth import get_user_model, authenticate
from django.shortcuts import get_object_or_404
from tenants.models import Tenant
from drf_spectacular.utils import extend_schema
from core.mixins import TenantFilteredViewSet
from .models import UserRole
from .serializers import UserSerializer, UserRoleSerializer, TenantAwareTokenObtainPairSerializer, AssignRoleSerializer
from .permissions import IsTenantAdmin
from billing.utils import check_plan_limit

User = get_user_model()

# ----------------------------------------------------------
#  User ViewSet
# ----------------------------------------------------------
class UserViewSet(TenantFilteredViewSet):
    """
    Manage users within a tenant.
    - Only TenantAdmins can create, update, or delete users.
    - Managers, Staff, and FinanceOfficers can list or view their own profile.
    """
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, IsTenantAdmin]

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            return User.objects.all()
        tenant = getattr(user, "tenant", None)
        if not tenant:
            return User.objects.none()
        return User.objects.filter(tenant=tenant)

    def get_permissions(self):
        """
        Apply stricter permissions for write operations.
        """
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsTenantAdmin()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        """
        Use UserCreateSerializer for creation to expose the password field.
        """
        if self.action == "create":
            from .serializers import UserCreateSerializer
            return UserCreateSerializer
        return UserSerializer
    
    def perform_create(self, serializer):
        """
        Enforce plan limits before creating new users.
        """
        tenant = getattr(self.request.user, "tenant", None)
        if tenant:
            current_user_count = tenant.users.count()
            check_plan_limit(tenant, "max_users", current_user_count)
        serializer.save(tenant=tenant)

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def me(self, request):
        """
        Return the current logged-in user's details.
        """
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)




# ----------------------------------------------------------
#  UserRole ViewSet 
# ----------------------------------------------------------
class UserRoleViewSet(mixins.ListModelMixin,
                      mixins.RetrieveModelMixin,
                      viewsets.GenericViewSet):
    """
    Read-only viewset for predefined system roles.
    """
    queryset = UserRole.objects.all()
    serializer_class = UserRoleSerializer
    permission_classes = [IsAuthenticated]


# ----------------------------------------------------------
#  Auth Helper View (for tenant users to get tokens)
# ----------------------------------------------------------
@extend_schema(tags=["Tenant Login"])  # ✅ clean group title in Swagger
class TenantAwareAuthViewSet(viewsets.ViewSet):
    """
    Handles tenant-aware login for users.
    Accepts tenant name, username, and password to generate JWT tokens.
    """

    permission_classes = [AllowAny]

    @extend_schema(
        summary="Tenant Login",
        description="Authenticate user using tenant, username, and password to obtain access and refresh tokens.",
        request=TenantAwareTokenObtainPairSerializer,
        responses={200: TenantAwareTokenObtainPairSerializer},
    )
    @action(detail=False, methods=["post"])
    def login(self, request):
        """
        POST /api/v1/login/
        """
        serializer = TenantAwareTokenObtainPairSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data, status=status.HTTP_200_OK)


class UserRoleAssignViewSet(TenantFilteredViewSet):
    """
    Allows tenant admins to assign predefined roles to users within their tenant.
    """
    queryset = User.objects.all()
    serializer_class = AssignRoleSerializer
    permission_classes = [IsAuthenticated, IsTenantAdmin]

    @action(detail=True, methods=["post"], url_path="assign-role")
    def assign_role(self, request, pk=None):
        """
        POST /api/users/{id}/assign-role/
        {
            "role": "manager"
        }
        """
        try:
            user = self.get_object()
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            role = serializer.validated_data["role"]

            # Tenant check — ensure same tenant
            if user.tenant != request.user.tenant:
                return Response(
                    {"error": "You can only modify users in your own tenant."},
                    status=status.HTTP_403_FORBIDDEN,
                )

            user.role = role
            user.save()

            return Response(
                {
                    "message": f"Role '{role}' assigned successfully to {user.username}.",
                    "user_id": user.id,
                    "role": role.name,
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
