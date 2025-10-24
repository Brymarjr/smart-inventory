from rest_framework import serializers
from django.contrib.auth import get_user_model, authenticate
from django.contrib.auth.password_validation import validate_password
from .models import UserRole
from rest_framework_simplejwt.tokens import RefreshToken
from tenants.models import Tenant

User = get_user_model()

# ===========================
# USER SERIALIZERS
# ===========================

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'password', 'is_active', 'is_staff']
        read_only_fields = ['id', 'is_staff']


class UserCreateSerializer(serializers.ModelSerializer):
    # override to avoid DRF/model UniqueValidator that checks global uniqueness
    username = serializers.CharField(max_length=150, validators=[])
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])

    # Use slug field so clients send role by name (e.g., "manager") instead of numeric id
    role = serializers.SlugRelatedField(
        slug_field='name',
        queryset=UserRole.objects.all(),
        required=False,
        allow_null=True
    )

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password', 'first_name', 'last_name', 'role']

    def _resolve_tenant(self):
        """
        Resolve tenant from the serializer context.
        Priority:
          1. self.context['tenant'] (explicit passed in)
          2. self.context['request'].tenant (middleware)
          3. request.user.tenant (authenticated creator)
          4. None
        """
        tenant = self.context.get('tenant', None)
        request = self.context.get('request', None)

        if tenant is None and request is not None:
            tenant = getattr(request, "tenant", None)

        if tenant is None and request is not None and getattr(request, "user", None) and request.user.is_authenticated:
            tenant = getattr(request.user, "tenant", None)

        return tenant

    def validate(self, attrs):
        """
        Validate uniqueness within the resolved tenant by checking the
        namespaced/stored username we will insert into the DB.
        """
        tenant = self._resolve_tenant()
        raw_username = attrs.get("username")
        email = attrs.get("email")

        # build the stored username that will actually be saved to DB
        if tenant:
            stored_username = f"{tenant.id}__{raw_username}"
        else:
            stored_username = raw_username

        # check username existence on the stored username (global check is fine because stored_username is namespaced)
        if User.objects.filter(username=stored_username).exists():
            raise serializers.ValidationError({"username": "A user with that username already exists in this tenant."})

        # check email uniqueness scoped to tenant
        if email:
            if tenant:
                if User.objects.filter(email=email, tenant=tenant).exists():
                    raise serializers.ValidationError({"email": "A user with that email already exists in this tenant."})
            else:
                if User.objects.filter(email=email, tenant__isnull=True).exists():
                    raise serializers.ValidationError({"email": "A user with that email already exists (no tenant)."})

        # stash constructed stored_username so create() can use it
        attrs['_stored_username'] = stored_username
        return attrs

    def create(self, validated_data):
        # take stored username prepared in validate()
        stored_username = validated_data.pop('_stored_username', None)
        password = validated_data.pop('password')
        # resolved tenant again (just in case)
        tenant = self._resolve_tenant()
        role = validated_data.pop('role', None)

        user = User(
            username=stored_username if stored_username is not None else validated_data.get('username'),
            email=validated_data.get('email', ''),
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
        )

        if tenant is not None:
            user.tenant = tenant

        if role:
            user.role = role

        user.set_password(password)
        user.save()
        return user



class PasswordResetSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    new_password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    
class AdminForcePasswordResetSerializer(serializers.Serializer):
    user_id = serializers.IntegerField(required=True)
    new_password = serializers.CharField(write_only=True, required=True, validators=[validate_password])


class UserRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserRole
        fields = ['id', 'name', 'description']
        
        
class TenantAwareTokenObtainPairSerializer(serializers.Serializer):
    tenant = serializers.CharField(required=True)
    username = serializers.CharField(required=True)
    password = serializers.CharField(required=True, write_only=True)

    def validate(self, attrs):
        tenant = attrs.get("tenant")
        username = attrs.get("username")
        password = attrs.get("password")

        # Validate tenant
        try:
            tenant = Tenant.objects.get(name__iexact=tenant)
        except Tenant.DoesNotExist:
            raise serializers.ValidationError({"tenant": "Invalid tenant name"})

        # Compute prefixed username format (e.g., "1__Testadmin1")
        tenant_prefixed_username = f"{tenant.id}__{username}"

        # Get the user using the prefixed username
        try:
            user = User.objects.get(username=tenant_prefixed_username, tenant=tenant)
        except User.DoesNotExist:
            raise serializers.ValidationError({"detail": "Invalid credentials"})

        # Check password manually
        if not user.check_password(password):
            raise serializers.ValidationError({"detail": "Invalid credentials"})

        if not user.is_active:
            raise serializers.ValidationError({"detail": "User account is inactive"})

        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)
        data = {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "user": {
                "id": user.id,
                "username": username,  # return clean username (no prefix)
                "tenant": tenant.name,
                "is_superuser": user.is_superuser,
            },
        }
        return data
    

class RoleSerializer(serializers.Serializer):
    """
    Lightweight serializer for static system roles.
    These roles are not stored in the database.
    """
    key = serializers.CharField()
    name = serializers.CharField()
    description = serializers.CharField()


class AssignRoleSerializer(serializers.Serializer):
    role = serializers.SlugRelatedField(
        slug_field="name",  # 👈 changed from "slug" to "name"
        queryset=UserRole.objects.all(),
        required=True,
        help_text="Role name to assign (e.g., 'tenant_admin', 'manager', 'staff', 'finance_officer')."
    )
