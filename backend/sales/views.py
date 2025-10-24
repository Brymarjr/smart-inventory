from rest_framework import status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from core.mixins import TenantFilteredViewSet
from users.permissions import IsStaff, IsTenantAdminManagerOrFinance
from .models import Sale
from .serializers import SaleCreateSerializer, SaleReadSerializer


class SaleViewSet(TenantFilteredViewSet):
    """
    Handles sales creation (by staff) and viewing (by admins, managers, finance).
    Uses TenantFilteredViewSet to ensure all queries are scoped to request.user.tenant.
    """

    queryset = (
        Sale.objects.all()
        .select_related("created_by", "tenant")
        .prefetch_related("items__product")
    )
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        """Assign permissions based on action."""
        if self.action == "create":
            permission_classes = [IsAuthenticated, IsStaff]
        else:
            permission_classes = [IsAuthenticated, IsTenantAdminManagerOrFinance]
        return [perm() for perm in permission_classes]

    def get_serializer_class(self):
        """Choose serializer based on action."""
        return SaleCreateSerializer if self.action == "create" else SaleReadSerializer

    def list(self, request, *args, **kwargs):
        """List all sales for the tenant."""
        queryset = self.get_queryset()
        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page or queryset, many=True)
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        """Retrieve details of a single sale."""
        sale = self.get_queryset().filter(pk=pk).first()
        if not sale:
            return Response({"detail": "Sale not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = self.get_serializer(sale)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        """Create a new sale transaction."""
        serializer = SaleCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)

        # ✅ Inject tenant and created_by into save() explicitly
        sale = serializer.save(
            tenant=request.user.tenant,
            created_by=request.user
        )

        read_serializer = SaleReadSerializer(sale, context={"request": request})
        return Response(read_serializer.data, status=status.HTTP_201_CREATED)



