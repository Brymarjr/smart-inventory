"""
Support Views Module.

This module powers the "Help Desk" functionality. It handles two distinct types of support:
1.  **Platform Support (TicketViewSet):** Communication between a Tenant and the SaaS Platform Administrators.
    - Used for bug reports, billing issues, or feature requests.
2.  **Internal Support (ContactTenantAdminView):** Communication between a Staff Member and their own Tenant Admin.
    - Used when a cashier needs help from their store manager (e.g., "I forgot my password").

Key Features:
- **Bi-directional Notifications:** If Support replies, the User is notified. If the User replies, Support is notified.
- **State Locking:** Closed tickets are immutable to preserve audit history.
"""

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
    """
    Custom Permission for Ticket Access.
    
    Allows access if:
    1. User is a Superuser (Platform Support Staff).
    2. User belongs to the same Tenant as the Ticket (The Customer).
    """
    def has_permission(self, request, view):
        return request.user.is_authenticated
    def has_object_permission(self, request, view, obj):
        if request.user.is_superuser: return True
        return obj.tenant == request.user.tenant

class TicketViewSet(viewsets.ModelViewSet):
    """
    Manages Platform Support Tickets.

    This is the main channel for Tenants to talk to the SaaS Owners.

    Capabilities:
    - **List:** Superusers see global tickets; Tenants see only their own tickets.
    - **Create:** Tenants open new tickets (Status: Open).
    - **Reply:** Both parties can add comments via the `reply` action.
    - **Status:** Superusers generally manage the status (Open -> In Progress -> Resolved).
    """
    serializer_class = TicketSerializer
    permission_classes = [IsSupportStaffOrOwner]

    def get_queryset(self):
        """
        Visibility Logic:
        - Superusers: See ALL tickets (Global View).
        - Tenant Users: See ONLY tickets linked to their Tenant ID.
        """
        user = self.request.user
        if user.is_superuser:
            return Ticket.objects.all().order_by('-created_at')
        if user.tenant:
            return Ticket.objects.filter(tenant=user.tenant).order_by('-created_at')
        return Ticket.objects.none()

    def perform_create(self, serializer):
        """
        Creates a new ticket.
        Automatically links it to the Requestor's Tenant.
        """
        if not self.request.user.tenant:
            raise serializers.ValidationError("You must belong to a tenant to open a ticket.")
        serializer.save(tenant=self.request.user.tenant, created_by=self.request.user, status='open')

    def perform_update(self, serializer):
        """
        Updates ticket details or status.
        
        Enforces:
        1. **Immutability:** Closed tickets cannot be edited by anyone.
        2. **Notifications:** If the status changes (e.g., Open -> Resolved), notify the creator.
        """
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
        """
        Adds a comment to the ticket thread.

        Logic:
        1. **Validation:** Cannot reply to closed tickets.
        2. **Notification:** - If Support replies -> Notify User.
           - If User replies -> Notify Support (implicitly) and Re-open ticket if it was 'Resolved'.
        """
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
    """
    Internal Communication Endpoint.
    
    Allows a Staff member (e.g., Cashier) to send an urgent alert to 
    ALL Administrators of their specific Tenant.
    
    Use Case: "I cannot login", "Printer is broken", etc.
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        serializer = ContactTenantAdminSerializer(data=request.data)
        if serializer.is_valid():
            user = request.user
            if not user.tenant: return Response({"error": "No tenant"}, 400)
            
            # Find all admins for THIS tenant
            admins = User.objects.filter(tenant=user.tenant, role__name='tenant_admin')
            if not admins: return Response({"error": "No admin found"}, 404)
            
            # Broadcast notification
            for admin in admins:
                notify_user(
                    tenant=user.tenant, recipient=admin, 
                    title=f"Support: {serializer.validated_data['subject']}", 
                    message=serializer.validated_data['message'], 
                    notification_type='alert'
                )
            return Response({"message": "Notified"})
        return Response(serializer.errors, 400)