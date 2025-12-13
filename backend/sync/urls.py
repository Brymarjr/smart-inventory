from rest_framework.routers import DefaultRouter
from django.urls import path, include
from .views import DeviceViewSet, SyncUploadView, SyncJobViewSet, SyncDownloadView

router = DefaultRouter()
router.register(r"devices", DeviceViewSet, basename="sync-device")
router.register(r"jobs", SyncJobViewSet, basename="sync-job")

urlpatterns = [
    path("", include(router.urls)),
    path("upload/", SyncUploadView.as_view(), name="sync-upload"),
    path("download/", SyncDownloadView.as_view(), name="sync-download"),
]
