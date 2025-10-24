from rest_framework import viewsets

class TenantFilteredViewSet(viewsets.ModelViewSet):
    """Base ViewSet that automatically filters by tenant,
    but allows superusers to see all data.
    """

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user

        # ✅ If user is superuser → see all tenant data
        if user.is_authenticated and user.is_superuser:
            return qs

        # ✅ Otherwise → filter by user's tenant
        if user.is_authenticated and hasattr(user, "tenant") and user.tenant:
            return qs.filter(tenant=user.tenant)

        # If user has no tenant or not logged in → see nothing
        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user

        # ✅ If superuser creates data → no forced tenant assignment
        if user.is_authenticated and user.is_superuser:
            serializer.save()
        elif user.is_authenticated and hasattr(user, "tenant") and user.tenant:
            serializer.save(tenant=user.tenant)
        else:
            serializer.save()


