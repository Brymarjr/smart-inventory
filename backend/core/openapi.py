from drf_spectacular.utils import OpenApiParameter, OpenApiTypes

def add_x_tenant_parameter(result, generator, request, public):
    """Add X-Tenant header to every endpoint in the schema (JSON-serializable)."""
    x_tenant_param = {
        "name": "X-Tenant",
        "in": "header",
        "description": "Tenant identifier (required for multi-tenant requests). Example: tenant_slug",
        "required": False,
        "schema": {"type": "string"},
    }

    # Ensure components exist
    result.setdefault("components", {})
    result["components"].setdefault("parameters", {})
    result["components"]["parameters"]["X-Tenant"] = x_tenant_param

    # Add to each path & method
    for path, path_item in result.get("paths", {}).items():
        for method, operation in path_item.items():
            if isinstance(operation, dict):
                operation.setdefault("parameters", [])
                # avoid duplicate
                if not any(
                    p.get("$ref", "").endswith("X-Tenant") or p.get("name") == "X-Tenant"
                    for p in operation["parameters"]
                ):
                    operation["parameters"].append({"$ref": "#/components/parameters/X-Tenant"})

    return result

