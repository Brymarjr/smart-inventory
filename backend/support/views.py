from rest_framework import viewsets, status, views, serializers, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError
from django.contrib.auth import get_user_model
from .models import Ticket, TicketComment
from .serializers import TicketSerializer, ContactTenantAdminSerializer, TicketCommentSerializer
from notifications.utils import notify_user 

User = get_user_model()

class IsSupportStaffOrOwner(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated
    def has_object_permission(self, request, view, obj):
        if request.user.is_superuser: return True
        return obj.tenant == request.user.tenant

class TicketViewSet(viewsets.ModelViewSet):
    serializer_class = TicketSerializer
    permission_classes = [IsSupportStaffOrOwner]

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            return Ticket.objects.all().order_by('-created_at')
        if user.tenant:
            return Ticket.objects.filter(tenant=user.tenant).order_by('-created_at')
        return Ticket.objects.none()

    def perform_create(self, serializer):
        if not self.request.user.tenant:
            raise serializers.ValidationError("You must belong to a tenant to open a ticket.")
        serializer.save(tenant=self.request.user.tenant, created_by=self.request.user, status='open')

    def perform_update(self, serializer):
        instance = self.get_object()
        
        # RULE: If currently closed, NOBODY can edit it.
        if instance.status == 'closed':
            raise ValidationError("This ticket is closed and cannot be modified. Please open a new ticket.")

        old_status = instance.status
        updated_ticket = serializer.save()
        
        if old_status != updated_ticket.status:
            # Decide who to notify
            is_support_action = self.request.user.is_superuser
            
            # If Support changed it, notify Tenant
            if is_support_action:
                recipient = updated_ticket.created_by
                title = f"Ticket Updated: {updated_ticket.subject}"
                msg = f"Status changed to: {updated_ticket.get_status_display()}"
            else:
                # If Tenant changed it (e.g. marked Closed), notify Support (optional, usually silent or internal log)
                recipient = None 

            if recipient:
                notify_user(tenant=updated_ticket.tenant, recipient=recipient, title=title, message=msg, notification_type='info')

    # ENDPOINT: Add Comment (/api/support/tickets/1/reply/)
    @action(detail=True, methods=['post'])
    def reply(self, request, pk=None):
        ticket = self.get_object()
        
        # RULE: Cannot reply to closed tickets
        if ticket.status == 'closed':
            return Response({"error": "This ticket is closed."}, status=400)

        serializer = TicketCommentSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(ticket=ticket, user=request.user)
            
            # Logic: If I reply, notify the OTHER party
            is_support = request.user.is_superuser
            
            if is_support:
                # Support replied -> Notify Tenant
                recipient = ticket.created_by
                title = f"New Reply: {ticket.subject}"
                message = f"Support: {serializer.validated_data['message']}"
            else:
                # Tenant replied -> Notify Support System (Usually filtered, but we can notify specific admins if needed)
                # For now, we update status to 'Open' if it was 'Resolved' so support sees it again
                if ticket.status == 'resolved':
                    ticket.status = 'in_progress' # Re-open discussion
                    ticket.save()
                recipient = None 

            if recipient:
                notify_user(tenant=ticket.tenant, recipient=recipient, title=title, message=message, notification_type='message')

            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ContactTenantAdminView(views.APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        serializer = ContactTenantAdminSerializer(data=request.data)
        if serializer.is_valid():
            user = request.user
            if not user.tenant: return Response({"error": "No tenant"}, 400)
            admins = User.objects.filter(tenant=user.tenant, role__name='tenant_admin')
            if not admins: return Response({"error": "No admin found"}, 404)
            
            # ... (notification logic) ...
            for admin in admins:
                notify_user(
                    tenant=user.tenant, recipient=admin, 
                    title=f"Support: {serializer.validated_data['subject']}", 
                    message=serializer.validated_data['message'], 
                    notification_type='alert'
                )
            return Response({"message": "Notified"})
        return Response(serializer.errors, 400)