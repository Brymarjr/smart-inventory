from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TicketViewSet, ContactTenantAdminView

router = DefaultRouter()
router.register(r'tickets', TicketViewSet, basename='tickets')

urlpatterns = [
    path('', include(router.urls)),
    path('contact-admin/', ContactTenantAdminView.as_view(), name='contact-tenant-admin'),
]