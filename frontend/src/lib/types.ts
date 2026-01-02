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
  role?: string | null;
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
  // Backend sends 'price', NOT 'unit_price'
  price: string; 
  // We calculated 'low_stock_threshold' logic in frontend, 
  // but let's just use reorder_level as the threshold.
}

