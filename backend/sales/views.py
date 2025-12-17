from rest_framework import status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from core.mixins import TenantFilteredViewSet
from users.permissions import (
    IsStaff,
    IsTenantAdminManagerOrFinance,
    MustChangePasswordPermission,
)
from .models import Sale
from .serializers import SaleCreateSerializer, SaleReadSerializer
from billing.utils import require_feature


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
    permission_classes = [IsAuthenticated, MustChangePasswordPermission]

    def get_permissions(self):
        if self.action == "create":
            permission_classes = [
                IsAuthenticated,
                IsStaff,
                MustChangePasswordPermission,
            ]
        else:
            permission_classes = [
                IsAuthenticated,
                IsTenantAdminManagerOrFinance,
                MustChangePasswordPermission,
            ]
        return [perm() for perm in permission_classes]

    def get_serializer_class(self):
        return SaleCreateSerializer if self.action == "create" else SaleReadSerializer

    def _get_tenant_or_403(self, request):
        tenant = getattr(request.user, "tenant", None)
        if tenant is None:
            raise PermissionDenied("Tenant context not found.")
        return tenant

    def list(self, request, *args, **kwargs):
        tenant = self._get_tenant_or_403(request)
        require_feature(tenant, "sales_view")

        queryset = self.get_queryset()
        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page or queryset, many=True)

        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        tenant = self._get_tenant_or_403(request)
        require_feature(tenant, "sales_view")

        sale = self.get_queryset().filter(pk=pk).first()
        if not sale:
            return Response(
                {"detail": "Sale not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = self.get_serializer(sale)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        tenant = self._get_tenant_or_403(request)
        require_feature(tenant, "sales_view")

        serializer = SaleCreateSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)

        sale = serializer.save(
            tenant=tenant,
            created_by=request.user,
        )

        read_serializer = SaleReadSerializer(
            sale,
            context={"request": request},
        )
        return Response(
            read_serializer.data,
            status=status.HTTP_201_CREATED,
        )




