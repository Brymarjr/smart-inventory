from rest_framework import viewsets, permissions, status, mixins
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.crypto import get_random_string
from drf_spectacular.utils import extend_schema
from .tasks import send_password_reset_email
from tenants.models import Tenant
from core.mixins import TenantFilteredViewSet
from billing.utils import check_plan_limit
from .permissions import MustChangePasswordPermission

from .models import UserRole
from .permissions import IsTenantAdmin
from .serializers import (
    UserSerializer,
    UserCreateSerializer,
    UserRoleSerializer,
    TenantAwareTokenObtainPairSerializer,
    AssignRoleSerializer,
    ForgotPasswordRequestSerializer,
    ResetPasswordConfirmSerializer,
    AdminInitiatePasswordResetSerializer,
    ChangePasswordSerializer,
)

User = get_user_model()


# ----------------------------------------------------------
#  User ViewSet
# ----------------------------------------------------------
class UserViewSet(TenantFilteredViewSet):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, IsTenantAdmin, MustChangePasswordPermission]

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            return User.objects.all()
        tenant = getattr(user, "tenant", None)
        if not tenant:
            return User.objects.none()
        return User.objects.filter(tenant=tenant)

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsTenantAdmin()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        return UserSerializer

    def perform_create(self, serializer):
        tenant = getattr(self.request.user, "tenant", None)
        if tenant:
            current_user_count = tenant.users.count()
            check_plan_limit(tenant, "max_users", current_user_count)
        serializer.save(tenant=tenant)

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def me(self, request):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)


# ----------------------------------------------------------
#  Password Reset ViewSet
# ----------------------------------------------------------
class PasswordResetViewSet(viewsets.ViewSet):
    """
    Handles all password reset flows.
    """

    permission_classes = [AllowAny, MustChangePasswordPermission]

    def _generate_temp_password(self):
        return get_random_string(12)

    def _send_password_email(self, user, temp_password):
        send_password_reset_email.delay(user.id, temp_password)

        print(
            f"[EMAIL] To: {user.email} | "
            f"Temporary Password: {temp_password}"
        )

    @extend_schema(request=ForgotPasswordRequestSerializer)
    @action(detail=False, methods=["post"])
    def forgot_password(self, request):
        serializer = ForgotPasswordRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response(
                {"detail": "If the email exists, a reset has been sent."},
                status=status.HTTP_200_OK,
            )

        temp_password = self._generate_temp_password()
        user.set_password(temp_password)
        user.must_change_password = True
        user.password_reset_sent_at = timezone.now()
        user.save()

        self._send_password_email(user, temp_password)

        return Response(
            {"detail": "Password reset email sent."},
            status=status.HTTP_200_OK,
        )

    @extend_schema(request=AdminInitiatePasswordResetSerializer)
    @action(
        detail=False,
        methods=["post"],
        permission_classes=[IsAuthenticated, IsTenantAdmin],
    )
    def admin_reset_password(self, request):
        serializer = AdminInitiatePasswordResetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user_id = serializer.validated_data["user_id"]
        target_user = get_object_or_404(User, id=user_id)

        if target_user.tenant != request.user.tenant:
            return Response(
                {"detail": "You can only reset users in your tenant."},
                status=status.HTTP_403_FORBIDDEN,
            )

        temp_password = self._generate_temp_password()
        target_user.set_password(temp_password)
        target_user.must_change_password = True
        target_user.password_reset_sent_at = timezone.now()
        target_user.save()

        self._send_password_email(target_user, temp_password)

        return Response(
            {"detail": "User password reset successfully."},
            status=status.HTTP_200_OK,
        )

    @extend_schema(request=ChangePasswordSerializer)
    @action(
        detail=False,
        methods=["post"],
        permission_classes=[IsAuthenticated],
    )
    def change_password(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        current_password = serializer.validated_data["current_password"]
        new_password = serializer.validated_data["new_password"]

        if not user.check_password(current_password):
            return Response(
                {"detail": "Current password is incorrect."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.must_change_password = False
        user.password_reset_sent_at = None
        user.save()

        return Response(
            {"detail": "Password changed successfully."},
            status=status.HTTP_200_OK,
        )


# ----------------------------------------------------------
#  UserRole ViewSet
# ----------------------------------------------------------
class UserRoleViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    queryset = UserRole.objects.all()
    serializer_class = UserRoleSerializer
    permission_classes = [IsAuthenticated]


# ----------------------------------------------------------
#  Tenant Login
# ----------------------------------------------------------
@extend_schema(tags=["Tenant Login"])
class TenantAwareAuthViewSet(viewsets.ViewSet):
    permission_classes = [AllowAny]

    @extend_schema(
        summary="Tenant Login",
        request=TenantAwareTokenObtainPairSerializer,
        responses={200: TenantAwareTokenObtainPairSerializer},
    )
    @action(detail=False, methods=["post"])
    def login(self, request):
        serializer = TenantAwareTokenObtainPairSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data, status=status.HTTP_200_OK)


# ----------------------------------------------------------
#  Assign Role
# ----------------------------------------------------------
class UserRoleAssignViewSet(TenantFilteredViewSet):
    queryset = User.objects.all()
    serializer_class = AssignRoleSerializer
    permission_classes = [IsAuthenticated, IsTenantAdmin]

    @action(detail=True, methods=["post"], url_path="assign-role")
    def assign_role(self, request, pk=None):
        user = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        role = serializer.validated_data["role"]

        if user.tenant != request.user.tenant:
            return Response(
                {"error": "You can only modify users in your tenant."},
                status=status.HTTP_403_FORBIDDEN,
            )

        user.role = role
        user.save()

        return Response(
            {
                "message": f"Role '{role.name}' assigned successfully.",
                "user_id": user.id,
            },
            status=status.HTTP_200_OK,
        )
