from rest_framework import serializers
from .models import Ticket, TicketComment

class TicketCommentSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    is_staff = serializers.BooleanField(source='user.is_staff', read_only=True)
    is_superuser = serializers.BooleanField(source='user.is_superuser', read_only=True)

    class Meta:
        model = TicketComment
        fields = ['id', 'user', 'user_name', 'is_staff', 'is_superuser', 'message', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']
        
        
class TicketSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    created_by_email = serializers.EmailField(source='created_by.email', read_only=True)
    comments = TicketCommentSerializer(many=True, read_only=True) # Nested comments

    class Meta:
        model = Ticket
        fields = [
            'id', 'tenant', 'tenant_name', 
            'created_by', 'created_by_name', 'created_by_email',
            'subject', 'message', 'status', 'priority', 'comments',
            'internal_notes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['tenant', 'created_by', 'internal_notes', 'created_at', 'updated_at']


class ContactTenantAdminSerializer(serializers.Serializer):
    """
    Form for Staff/Managers to contact their boss.
    """
    subject = serializers.CharField(max_length=200)
    message = serializers.CharField(style={'base_template': 'textarea.html'})
    priority = serializers.ChoiceField(choices=['low', 'medium', 'high'])