# notifications/views.py

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from core.mixins import TenantFilteredViewSet
from .models import Notification
from .serializers import NotificationSerializer



class NotificationViewSet(TenantFilteredViewSet):
    """
    Notifications are system-generated.
    Users can only read and mark them as read.
    """

    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        Only return notifications:
        - For the current tenant (handled by TenantFilteredViewSet)
        - For the logged-in user
        """
        return Notification.objects.filter(
            recipient=self.request.user
        )

    def create(self, request, *args, **kwargs):
        return Response(
            {"detail": "Notifications cannot be created via API."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def update(self, request, *args, **kwargs):
        return Response(
            {"detail": "Notifications cannot be updated via API."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def destroy(self, request, *args, **kwargs):
        return Response(
            {"detail": "Notifications cannot be deleted via API."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    @action(detail=True, methods=["post"])
    def mark_read(self, request, pk=None):
        """
        Mark a single notification as read
        """
        notification = self.get_object()
        notification.is_read = True
        notification.save(update_fields=["is_read"])

        return Response(
            {"detail": "Notification marked as read."},
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["post"])
    def mark_all_read(self, request):
        """
        Mark all unread notifications as read for the current user
        """
        updated = Notification.objects.filter(
            tenant=request.user.tenant,
            recipient=request.user,
            is_read=False,
        ).update(is_read=True)

        return Response(
            {
                "detail": f"{updated} notifications marked as read."
            },
            status=status.HTTP_200_OK,
        )

