# users/tokens.py
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Add tenant data to token payload if available
        tenant = getattr(user, "tenant", None)
        if tenant:
            token['tenant_id'] = tenant.id
            token['tenant_name'] = tenant.name
        # Optionally add a primary role snapshot
        try:
            roles = [ur.role.name for ur in user.user_roles.select_related('role').all()]
            token['roles'] = roles
        except Exception:
            token['roles'] = []
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user
        tenant = getattr(user, "tenant", None)
        if tenant:
            data['tenant_id'] = tenant.id
            data['tenant_name'] = tenant.name
        # include roles for client convenience
        try:
            data['roles'] = [ur.role.name for ur in user.user_roles.select_related('role').all()]
        except Exception:
            data['roles'] = []
        return data

