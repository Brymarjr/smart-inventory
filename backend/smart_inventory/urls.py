from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework_simplejwt.views import TokenRefreshView
from users.tokens import CustomTokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer



urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Auth routes
    path('api/auth/token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # API schema and docs
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),

    # your app APIs 
    path('api/', include('users.urls')),       
    path('api/', include('inventory.urls')),
    path('api/', include('tenants.urls')),
    path('api/billing/', include('billing.urls')),
    path("api/", include("purchases.urls")),
    path('api/', include('sales.urls')),
 
]
