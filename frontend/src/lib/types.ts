// src/lib/types.ts

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser?: boolean;
  tenant?: string | null;
  role: string;
  must_change_password?: boolean;
  tos_accepted_at?: string | null;
  tos_version?: string;
}

export interface AuthResponse {
  refresh: string;
  access: string;
  user: User;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Category {
  id: number;
  name: string;
  description?: string;
}

export interface Supplier {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  description: string;
  // Backend returns a full object, not just a name string
  category?: Category | null; 
  quantity: number;
  reorder_level: number;
  price: string; 
  // We calculated 'low_stock_threshold' logic in frontend, 
  // but let's just use reorder_level as the threshold.
}

export interface Plan {
  id: number;
  name: string;
  amount: number; // Raw amount from API (e.g., 5000 for ₦5,000)
  currency: string;
  duration_days: number;
  description: string;
  is_active: boolean;
}

export interface Subscription {
  id: number;
  tenant: number;
  plan: number; // Returns ID (e.g., 2)
  status: 'active' | 'inactive' | 'pending' | 'cancelled' | 'expired';
  started_at: string | null;
  expires_at: string | null;
  auto_renew: boolean;
}

export interface Transaction {
  id: number;
  reference: string;
  amount: number;
  currency: string;
  status: 'success' | 'failed' | 'pending';
  created_at: string;
  // Optional: if your backend returns nested objects
  tenant?: number; 
  subscription?: number;
}

// Add these for Sales/POS
export interface CartItem {
  productId: number;
  name: string;
  price: number;
  quantity: number;
  maxStock: number; // To prevent adding more than available
}

export interface SalePayload {
  customer_name?: string;
  payment_method: 'cash' | 'card' | 'transfer' | 'pos' | 'other';
  notes?: string;
  items: {
    product: number; // ID
    quantity: number;
  }[];
}

export interface Device {
  id: number;
  name: string;
  device_id: string; // The hardware UUID
  is_blocked: boolean;
  last_sync_at: string | null;
  app_version: string;
  consecutive_failures: number;
}

export interface SystemTenant {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
}

export interface SystemTenantDetail extends SystemTenant {
  admin_info: {
    full_name: string;
    email: string;
    username: string;
    total_admins: number;
  } | null;
  
  settings: {
    store_name: string | null;
    store_address: string | null;
    currency_symbol: string;
  } | null;
}

export interface AuditLog {
  id: number;
  actor_name: string;
  actor_email: string;
  action: string;
  target_model: string;
  target_name: string;
  reason: string;
  timestamp: string;
}