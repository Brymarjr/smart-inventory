from rest_framework import serializers
from django.db import transaction
from .models import Tenant
from users.models import User, UserRole


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

        # 1️⃣ Create tenant
        tenant = Tenant.objects.create(name=validated_data["tenant_name"])

        # 2️⃣ Prepare admin user data
        user_data = {
            "username": validated_data["username"],
            "email": validated_data["email"],
            "password": validated_data["password"],
            "first_name": validated_data.get("first_name", ""),
            "last_name": validated_data.get("last_name", ""),
        }

        # 3️⃣ Create the user for this tenant
        user_serializer = UserCreateSerializer(data=user_data, context={"tenant": tenant})
        user_serializer.is_valid(raise_exception=True)
        user = user_serializer.save()

        # 4️⃣ Promote to TenantAdmin
        user.is_staff = False
        user.is_superuser = False
        user.tenant = tenant  # ensure tenant relationship is explicit

        # 5️⃣ Assign TenantAdmin role automatically
        tenant_admin_role = UserRole.objects.get(name="tenant_admin")
        user.role = tenant_admin_role
        user.save()

        return {"tenant": tenant, "admin_user": user}




