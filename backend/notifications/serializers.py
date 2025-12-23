# notifications/serializers.py

from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    recipient_email = serializers.EmailField(
        source="recipient.email",
        read_only=True
    )

    class Meta:
        model = Notification
        fields = (
            "id",
            "tenant",
            "recipient",
            "recipient_email",
            "title",
            "message",
            "notification_type",
            "is_read",
            "created_at",
        )
        read_only_fields = (
            "id",
            "tenant",
            "recipient",
            "title",
            "message",
            "notification_type",
            "created_at",
        )
