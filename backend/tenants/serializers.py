from rest_framework import serializers
from django.db import transaction
from .models import Tenant, TenantSettings, AuditLog
from users.models import UserRole


class TenantRegistrationSerializer(serializers.Serializer):
    tenant_name = serializers.CharField(max_length=200)
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)

    def validate_tenant_name(self, value):
        if Tenant.objects.filter(name__iexact=value).exists():
            raise serializers.ValidationError("Tenant with this name already exists.")
        return value

    @transaction.atomic
    def create(self, validated_data):
        from users.serializers import UserCreateSerializer

        # 1 Create tenant
        tenant = Tenant.objects.create(name=validated_data["tenant_name"])

        # 2 Prepare admin user data
        user_data = {
            "username": validated_data["username"],
            "email": validated_data["email"],
            "password": validated_data["password"],
            "first_name": validated_data.get("first_name", ""),
            "last_name": validated_data.get("last_name", ""),
        }

        # 3 Create the user for this tenant
        user_serializer = UserCreateSerializer(data=user_data, context={"tenant": tenant})
        user_serializer.is_valid(raise_exception=True)
        user = user_serializer.save()
        
        user.must_change_password = False  # Admin user does not need to change password on first login

        # 4 Promote to TenantAdmin
        user.is_staff = False
        user.is_superuser = False
        user.tenant = tenant  # ensure tenant relationship is explicit

       # 5 Assign TenantAdmin role automatically
        try:
            tenant_admin_role = UserRole.objects.get(name="tenant_admin")
            user.role = tenant_admin_role
        except UserRole.DoesNotExist:
            # Fallback (optional, helps if roles aren't seeded yet)
            pass
        user.save()

        return {"tenant": tenant, "admin_user": user}


class TenantSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = TenantSettings
        fields = [
            'store_name', 'store_address', 'currency_symbol', 
            'low_stock_alerts', 'weekly_reports'
        ]


class AuditLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source='actor.username', read_only=True)
    actor_email = serializers.CharField(source='actor.email', read_only=True)

    class Meta:
        model = AuditLog
        fields = ['id', 'actor_name', 'actor_email', 'action', 'target_model', 'target_name', 'reason', 'timestamp']