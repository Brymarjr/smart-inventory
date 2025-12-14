from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework_simplejwt.tokens import RefreshToken
from tenants.models import Tenant
from .models import UserRole

User = get_user_model()

# ===========================
# USER SERIALIZERS
# ===========================

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'is_active',
            'is_staff',
        ]
        read_only_fields = ['id', 'is_staff']


class UserCreateSerializer(serializers.ModelSerializer):
    # Override to avoid DRF global uniqueness validator
    username = serializers.CharField(max_length=150, validators=[])
    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password]
    )

    role = serializers.SlugRelatedField(
        slug_field='name',
        queryset=UserRole.objects.all(),
        required=False,
        allow_null=True
    )

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'password',
            'first_name',
            'last_name',
            'role',
        ]

    def _resolve_tenant(self):
        tenant = self.context.get('tenant', None)
        request = self.context.get('request', None)

        if tenant is None and request is not None:
            tenant = getattr(request, "tenant", None)

        if (
            tenant is None
            and request is not None
            and getattr(request, "user", None)
            and request.user.is_authenticated
        ):
            tenant = getattr(request.user, "tenant", None)

        return tenant

    def validate(self, attrs):
        tenant = self._resolve_tenant()
        raw_username = attrs.get("username")
        email = attrs.get("email")

        if tenant:
            stored_username = f"{tenant.id}__{raw_username}"
        else:
            stored_username = raw_username

        if User.objects.filter(username=stored_username).exists():
            raise serializers.ValidationError(
                {"username": "A user with that username already exists in this tenant."}
            )

        if email:
            if tenant:
                if User.objects.filter(email=email, tenant=tenant).exists():
                    raise serializers.ValidationError(
                        {"email": "A user with that email already exists in this tenant."}
                    )
            else:
                if User.objects.filter(email=email, tenant__isnull=True).exists():
                    raise serializers.ValidationError(
                        {"email": "A user with that email already exists."}
                    )

        attrs['_stored_username'] = stored_username
        return attrs

    def create(self, validated_data):
        stored_username = validated_data.pop('_stored_username', None)
        password = validated_data.pop('password')
        tenant = self._resolve_tenant()
        role = validated_data.pop('role', None)

        user = User(
            username=stored_username,
            email=validated_data.get('email', ''),
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
        )

        if tenant:
            user.tenant = tenant

        if role:
            user.role = role

        user.set_password(password)
        user.save()
        return user


# ===========================
# PASSWORD RESET SERIALIZERS
# ===========================

class ForgotPasswordRequestSerializer(serializers.Serializer):
    """
    Normal tenant user initiates password reset.
    """
    email = serializers.EmailField(required=True)


class ResetPasswordConfirmSerializer(serializers.Serializer):
    """
    User completes password reset using token.
    """
    token = serializers.CharField(required=True)
    new_password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password]
    )


class AdminInitiatePasswordResetSerializer(serializers.Serializer):
    """
    Tenant admin forces password reset for a user.
    """
    user_id = serializers.IntegerField(required=True)


class ChangePasswordSerializer(serializers.Serializer):
    """
    Used when user logs in with temporary password
    and must change it immediately.
    """
    current_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(
        required=True,
        write_only=True,
        validators=[validate_password]
    )


# ===========================
# AUTH / LOGIN SERIALIZER
# ===========================

class TenantAwareTokenObtainPairSerializer(serializers.Serializer):
    tenant = serializers.CharField(required=True)
    username = serializers.CharField(required=True)
    password = serializers.CharField(required=True, write_only=True)

    def validate(self, attrs):
        tenant_name = attrs.get("tenant")
        username = attrs.get("username")
        password = attrs.get("password")

        try:
            tenant = Tenant.objects.get(name__iexact=tenant_name)
        except Tenant.DoesNotExist:
            raise serializers.ValidationError({"tenant": "Invalid tenant name"})

        tenant_prefixed_username = f"{tenant.id}__{username}"

        try:
            user = User.objects.get(
                username=tenant_prefixed_username,
                tenant=tenant
            )
        except User.DoesNotExist:
            raise serializers.ValidationError({"detail": "Invalid credentials"})

        if not user.check_password(password):
            raise serializers.ValidationError({"detail": "Invalid credentials"})

        if not user.is_active:
            raise serializers.ValidationError({"detail": "User account is inactive"})

        refresh = RefreshToken.for_user(user)

        return {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "user": {
                "id": user.id,
                "username": username,  # clean username
                "tenant": tenant.name,
                "is_superuser": user.is_superuser,
                "must_change_password": getattr(user, "must_change_password", False),
            },
        }


# ===========================
# ROLES
# ===========================

class UserRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserRole
        fields = ['id', 'name', 'description']


class RoleSerializer(serializers.Serializer):
    """
    Lightweight serializer for static system roles.
    """
    key = serializers.CharField()
    name = serializers.CharField()
    description = serializers.CharField()


class AssignRoleSerializer(serializers.Serializer):
    role = serializers.SlugRelatedField(
        slug_field="name",
        queryset=UserRole.objects.all(),
        required=True,
        help_text=(
            "Role name to assign "
            "(e.g., 'tenant_admin', 'manager', 'staff', 'finance_officer')."
        )
    )
