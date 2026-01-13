from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        
        # 1. Tenant Data (If they are a tenant)
        tenant = getattr(user, "tenant", None)
        if tenant:
            token['tenant_id'] = tenant.id
            token['tenant_name'] = tenant.name
        
        # 2. System Admin Flags (Critical for Frontend Routing)
        token['is_superuser'] = user.is_superuser
        token['is_staff'] = user.is_staff

        # 3. Roles
        try:
            roles = [ur.role.name for ur in user.user_roles.select_related('role').all()]
            token['roles'] = roles
        except Exception:
            token['roles'] = []
            
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user
        
        # 1. Tenant Data
        tenant = getattr(user, "tenant", None)
        if tenant:
            data['tenant_id'] = tenant.id
            data['tenant_name'] = tenant.name
        else:
            data['tenant_id'] = None
            data['tenant_name'] = None

        # 2. System Admin Flags in Response
        data['is_superuser'] = user.is_superuser
        data['is_staff'] = user.is_staff
        data['must_change_password'] = getattr(user, 'must_change_password', False)
        # 3. Roles
        try:
            data['roles'] = [ur.role.name for ur in user.user_roles.select_related('role').all()]
        except Exception:
            data['roles'] = []
            
        return data