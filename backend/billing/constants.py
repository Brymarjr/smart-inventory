"""
Billing Constants for ForeTrack.
Defines the exact feature flags and limits based on the existing modules:
Inventory, Sales, Purchases, Forecasting, Sync, Support, and Audit.
"""

PLAN_FEATURES = {
    'free': [
        # Basic survival features
        'inventory_basic',      # Can view/create products & categories
        'sales_basic',          # Can process sales at the POS
        'dashboard_basic',      # Sees Revenue, Top Sellers, Low Stock
        'sync_basic',           # Allowed 1 offline sync device
        'support_standard',     # Can submit basic support tickets
    ],
    
    'pro': [
        # Everything in Free, plus operational management
        'inventory_basic',
        'sales_basic',
        'dashboard_basic',
        'sync_basic',
        'support_standard',
        
        # PRO EXCLUSIVES
        'inventory_advanced',   # Access to Suppliers and Purchase Orders
        'dashboard_advanced',   # Sees Profit margins and growth Trends
        'sync_pro',             # Allowed up to 5 offline sync devices
        'audit_logs',           # Access to view system Audit Logs
    ],
    
    'enterprise': [
        # Everything in Pro, plus AI and unlimited scale
        'inventory_basic',
        'sales_basic',
        'dashboard_basic',
        'sync_basic',
        'support_standard',
        'inventory_advanced',
        'dashboard_advanced',
        'sync_pro',
        'audit_logs',
        
        # ENTERPRISE EXCLUSIVES
        'ml_forecasting',       # Access to AI demand forecasting & anomalies
        'sync_unlimited',       # Unlimited offline POS devices
        'support_priority',     # Priority queue for support tickets
    ],
}

PLAN_LIMITS = {
    'free': {
        'max_users': 3,         # 1 Admin, 2 other roles
        'max_products': 50,
        'max_categories': 5,
        'max_suppliers': 3,     # Maximum of 3 suppliers 
        'max_sync_devices': 1,  # 1 register allowed offline
    },
    'pro': {
        'max_users': 15,
        'max_products': 1000,
        'max_categories': 50,
        'max_suppliers': 25,
        'max_sync_devices': 5,
    },
    'enterprise': {
        'max_users': None,      # Unlimited
        'max_products': None,
        'max_categories': None,
        'max_suppliers': None,
        'max_sync_devices': None,
    },
}