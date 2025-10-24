from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PlanViewSet,
    SubscriptionViewSet,
    TransactionViewSet,
    paystack_webhook,
    PaystackVerifyView,
    GlobalSubscriptionViewSet,
    GlobalTransactionViewSet
)

# -------------------------------------------------------------
# Routers for DRF ViewSets (ensures automatic Swagger visibility)
# -------------------------------------------------------------
router = DefaultRouter()
router.register(r'plans', PlanViewSet, basename='plan')
router.register(r'subscriptions', SubscriptionViewSet, basename='subscription')
router.register(r'transactions', TransactionViewSet, basename='transaction')
router.register(r"admin/subscriptions", GlobalSubscriptionViewSet, basename="global-subscriptions")
router.register(r"admin/transactions", GlobalTransactionViewSet, basename="global-transactions")

# -------------------------------------------------------------
# URL Patterns
# -------------------------------------------------------------
urlpatterns = [
    path('', include(router.urls)),

    # Webhook endpoint — for Paystack POST callbacks
    path('paystack/webhook/', paystack_webhook, name='paystack-webhook'),

    # Manual verification endpoint — for Swagger/testing
    path('paystack/verify/', PaystackVerifyView.as_view(), name='paystack-verify'),
    
]

