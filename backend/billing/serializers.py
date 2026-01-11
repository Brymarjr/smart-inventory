from rest_framework import serializers
from .models import Plan, Subscription, Transaction

class PlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan
        fields = ['id', 'name', 'amount', 'currency', 'duration_days', 'description', 'is_active']


class SubscriptionSerializer(serializers.ModelSerializer):
    plan = serializers.PrimaryKeyRelatedField(queryset=Plan.objects.filter(is_active=True))
    tenant = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Subscription
        fields = ['id', 'tenant', 'plan', 'status', 'started_at', 'expires_at', 'paystack_reference', 'auto_renew', 'metadata']
        read_only_fields = ['status', 'started_at', 'expires_at', 'paystack_reference']

    def create(self, validated_data):
        # tenant must be passed via view.save(tenant=...)
        return super().create(validated_data)


class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = ['id', 'tenant', 'subscription', 'reference', 'amount', 'currency', 'status', 'raw_response', 'created_at']
        read_only_fields = ['status', 'raw_response', 'created_at']
