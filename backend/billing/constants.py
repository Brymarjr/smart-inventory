
PLAN_FEATURES = {
    'free': [
        'inventory_view',
        'sales_view',
        'low_stock_alerts',
    ],
    'pro': [
        'inventory_view',
        'sales_view',
        'purchases',
        'vendor_emails',
        'reports_basic',
        'low_stock_alerts',
        'sync_limited',
    ],
    'enterprise': [
        'inventory_view',
        'sales_view',
        'purchases',
        'vendor_emails',
        'reports_advanced',
        'ml_forecasting',
        'sync_full',
        'multi_store',
        'priority_support',
        'custom_branding',
    ],
}

PLAN_LIMITS = {
    'free': {
        'max_users': 5,
        'max_products': 50,
        'max_categories': 10,
        'max_suppliers': 10,
    },
    'pro': {
        'max_users': 25,
        'max_products': 500,
        'max_categories': 100,
        'max_suppliers': 50,
    },
    'enterprise': {
        'max_users': None,
        'max_products': None,
        'max_categories': None,
        'max_suppliers': None,
    },
}
