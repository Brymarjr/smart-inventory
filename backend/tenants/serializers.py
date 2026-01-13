from rest_framework import serializers
from django.db import transaction
from django.contrib.auth import get_user_model
from .models import Tenant, TenantSettings, AuditLog
from users.models import UserRole
User = get_user_model()

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
    actor_name = serializers.SerializerMethodField()
    actor_email = serializers.CharField(source='actor.email', read_only=True)

    class Meta:
        model = AuditLog
        fields = ['id', 'actor_name', 'actor_email', 'action', 'target_model', 'target_name', 'reason', 'timestamp']

    def get_actor_name(self, obj):
        # Handle cases where actor might be None (e.g. system tasks)
        if not obj.actor:
            return "System"

        # 1. PRIORITY: Try to show their real Full Name
        full_name = f"{obj.actor.first_name} {obj.actor.last_name}".strip()
        if full_name:
            return full_name

        # 2. FALLBACK: Show Username (but remove the "1__" prefix)
        username = obj.actor.username
        if "__" in username:
            # Splits "1__admin" into ["1", "admin"] and takes the second part
            return username.split("__", 1)[1] 
            
        return username
        
        
class TenantListSerializer(serializers.ModelSerializer):
    """
    Serializer for the System Admin Dashboard.
    Strictly uses fields defined in your Tenant model.
    """
    class Meta:
        model = Tenant
        fields = ['id', 'name', 'slug', 'is_active', 'created_at']
        
        
class TenantDetailSerializer(serializers.ModelSerializer):
    settings = TenantSettingsSerializer(read_only=True)
    
    # We will fetch the primary contact and a count of admins
    admin_info = serializers.SerializerMethodField()
    
    class Meta:
        model = Tenant
        fields = ['id', 'name', 'slug', 'is_active', 'created_at', 'settings', 'admin_info']

    def get_admin_info(self, obj):
        # 1. Find the Account Creator (First user ever created for this tenant)
        creator = User.objects.filter(tenant=obj).order_by('date_joined').first()
        
        # 2. Count how many admins total (TenantAdmin role)
        # Note: Adjust 'role__name' if your role system differs slightly
        total_admins = User.objects.filter(tenant=obj, role__name='tenant_admin').count()

        if creator:
            return {
                "full_name": f"{creator.first_name} {creator.last_name}".strip() or creator.username,
                "email": creator.email,
                "username": creator.username,
                "total_admins": total_admins # e.g., "John Doe (+2 others)"
            }
        return None