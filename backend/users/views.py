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
from .notifications import notify_password_changed, notify_role_changed
from tenants.models import Tenant
from core.mixins import TenantFilteredViewSet
from billing.utils import check_plan_limit
from .permissions import MustChangePasswordPermission, IsTenantAdmin
from .models import UserRole

from .serializers import (
    UserSerializer,
    UserCreateSerializer,
    UserRoleSerializer,
    TenantAwareTokenObtainPairSerializer,
    AssignRoleSerializer,
    ForgotPasswordRequestSerializer,
    AdminInitiatePasswordResetSerializer,
    ChangePasswordSerializer,
)

User = get_user_model()

# ----------------------------------------------------------
#  User ViewSet
# ----------------------------------------------------------
class UserViewSet(TenantFilteredViewSet):
    serializer_class = UserSerializer
    # Base permissions
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
        # Allows 'me' for any logged-in user (Staff/Manager/Admin)
        if self.action in ["me", "accept_tos"]:
            return [IsAuthenticated()]
        
        if self.action in ["create", "update", "partial_update", "destroy", "list"]:
            return [IsAuthenticated(), IsTenantAdmin()]
            
        return super().get_permissions()

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

    # Added "patch" method and update logic
    @action(detail=False, methods=["get", "patch"])
    def me(self, request):
        user = request.user

        if request.method == 'GET':
            serializer = self.get_serializer(user)
            return Response(serializer.data)
        
        elif request.method == 'PATCH':
            # Security: Prevent staff from escalating privileges
            # We copy the data and remove sensitive fields
            data = request.data.copy()
            restricted_fields = ['role', 'tenant', 'is_active', 'is_superuser', 'is_staff', 'groups', 'user_permissions']
            
            for field in restricted_fields:
                if field in data:
                    del data[field]

            serializer = self.get_serializer(user, data=data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
    @action(detail=False, methods=['post'], url_path='accept-tos')
    def accept_tos(self, request):
        """
        Endpoint for logged-in users to accept the Terms of Service.
        """
        user = request.user
        
        # Update the compliance fields
        user.tos_accepted_at = timezone.now()
        user.tos_version = "1.0.0" 
        user.save()
        
        return Response({
            "status": "Terms accepted", 
            "accepted_at": user.tos_accepted_at,
            "version": user.tos_version
        }, status=status.HTTP_200_OK)


# ----------------------------------------------------------
#  Password Reset ViewSet
# ----------------------------------------------------------
class PasswordResetViewSet(viewsets.ViewSet):
    """
    Handles all password reset flows.
    """
    # AllowAny for forgot_password, but Authenticated for the rest
    permission_classes = [AllowAny]

    def _generate_temp_password(self):
        # Increased length and complexity for security
        return get_random_string(length=12, allowed_chars='abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$')

    def _send_password_email(self, user, temp_password):
        # This task MUST fetch the email from the user ID in the DB
        # It should NOT rely on any email passed in arguments other than for logging
        send_password_reset_email.delay(user.id, temp_password)

    # 1. FORGOT PASSWORD (Public)
    @extend_schema(request=ForgotPasswordRequestSerializer)
    @action(detail=False, methods=["post"], permission_classes=[AllowAny])
    def forgot_password(self, request):
        serializer = ForgotPasswordRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"].strip().lower()

        try:
            # Lookup strictly by email
            user = User.objects.get(email=email)
            
            # Reset logic
            temp_password = self._generate_temp_password()
            user.set_password(temp_password)
            user.must_change_password = True
            user.password_reset_sent_at = timezone.now()
            user.save()

            # Security: Send to the stored User ID (Celery task looks up email)
            self._send_password_email(user, temp_password)

        except User.DoesNotExist:
            # Security: Timing Attack / Enumeration mitigation. 
            # We behave exactly the same whether user exists or not.
            pass

        return Response(
            {"detail": "If the email exists, a reset instruction has been sent."},
            status=status.HTTP_200_OK,
        )

    # 2. ADMIN RESET (Tenant Admin Only)
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
        
        # Security: Scope query to request.user.tenant to prevent Cross-Tenant Reset
        target_user = get_object_or_404(User, id=user_id, tenant=request.user.tenant)

        # Generate Temp Password
        temp_password = self._generate_temp_password()
        target_user.set_password(temp_password)
        target_user.must_change_password = True
        target_user.password_reset_sent_at = timezone.now()
        target_user.save()
        
        # Notifications
        notify_password_changed(target_user)
        self._send_password_email(target_user, temp_password)

        return Response(
            {"detail": f"Password reset for {target_user.email}. Email sent."},
            status=status.HTTP_200_OK,
        )

    # 3. CHANGE PASSWORD (Logged In User)
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

        # 1. Verify Old Password
        if not user.check_password(current_password):
            return Response(
                {"detail": "Current password is incorrect."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 2. Set New Password
        user.set_password(new_password)
        user.must_change_password = False # <--- Crucial: Unlocks the account
        user.password_reset_sent_at = None
        user.save()
        
        # 3. Notify
        notify_password_changed(user)

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

        new_role = serializer.validated_data["role"]
        old_role = user.role.name if user.role else None

        # Double check tenant scope (redundant with TenantFilteredViewSet but safe)
        if user.tenant != request.user.tenant:
            return Response(
                {"error": "You can only modify users in your tenant."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Prevent removing last tenant admin
        if old_role == "tenant_admin" and new_role.name != "tenant_admin":
            tenant_admin_count = User.objects.filter(
                tenant=user.tenant,
                role__name="tenant_admin",
                is_active=True
            ).count()
            if tenant_admin_count <= 1:
                return Response(
                    {"error": "Cannot remove the last tenant admin."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        user.role = new_role
        user.save()

        # Notify affected user and tenant admins
        notify_role_changed(user, old_role=old_role, new_role=new_role.name)

        return Response(
            {
                "message": f"Role '{new_role.name}' assigned successfully.",
                "user_id": user.id,
            },
            status=status.HTTP_200_OK,
        )