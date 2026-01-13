// src/lib/api.ts
import axios from 'axios';

// Default to localhost for development
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// --- Request Interceptor ---
api.interceptors.request.use(
  (config) => {
    // 1. Inject Access Token
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // 2. Inject Active Tenant (Crucial for Multi-tenancy)
    // We store this in localStorage during login
    const tenantSlug = typeof window !== 'undefined' ? localStorage.getItem('tenant_slug') : null;
    if (tenantSlug) {
      config.headers['X-Tenant'] = tenantSlug;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// --- Response Interceptor (Auto-Refresh Logic) ---
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 Unauthorized and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null;
      const tenantSlug = typeof window !== 'undefined' ? localStorage.getItem('tenant_slug') : null;

      if (refreshToken) {
        try {
          // Attempt to get a new token
          // Note: We use axios.post directly to avoid infinite loops with our 'api' instance
          const { data } = await axios.post(`${API_URL}/api/auth/token/refresh/`, {
            refresh: refreshToken,
          }, {
             // Some backends require tenant context even for refresh
             headers: tenantSlug ? { 'X-Tenant': tenantSlug } : {} 
          });

          // Store new access token
          localStorage.setItem('access_token', data.access);
          
          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${data.access}`;
          return api(originalRequest);
        } catch (refreshError) {
          // Refresh failed - Force logout
          if (typeof window !== 'undefined') {
             localStorage.clear();
             window.location.href = '/login';
          }
        }
      } else {
        // No refresh token available
        if (typeof window !== 'undefined') {
            localStorage.clear();
            window.location.href = '/login';
         }
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// 1. Update the import to include SystemTenantDetail
import { SystemTenant, SystemTenantDetail, AuditLog } from './types'; 

export const adminApi = {
  // Fetch all tenants (System Admin only)
  getAllTenants: async () => {
    const { data } = await api.get<SystemTenant[]>('/api/admin/tenants/');
    return data;
  },

  // 2. Add these two functions so the Detail Page works:
  getTenantDetails: async (id: string) => {
    // Fetches the single tenant + admin info + settings
    const { data } = await api.get<SystemTenantDetail>(`/api/admin/tenants/${id}/`);
    return data;
  },

  toggleTenantStatus: async (id: string) => {
    // Suspends or Activates the tenant
    const { data } = await api.post<{ status: string; is_active: boolean }>(
      `/api/admin/tenants/${id}/toggle_status/`
    );
    return data;
  },

  getTenantAuditLogs: async (id: string, page = 1) => {
    // Fetches paginated logs
    const { data } = await api.get<{ results: AuditLog[], count: number, next: string | null, previous: string | null }>(
      `/api/admin/tenants/${id}/audit_logs/?page=${page}`
    );
    return data;
  },

  // 1. Get Subscription for a specific tenant
  getTenantSubscription: async (tenantId: string) => {
    // We filter the global list by tenant ID
    const { data } = await api.get(`/api/billing/admin/subscriptions/?tenant=${tenantId}`);
    // The API returns a list, we just want the latest one (first item)
    return data.results && data.results.length > 0 ? data.results[0] : null;
  },

  // 2. Get Transactions for a specific tenant
  getTenantTransactions: async (tenantId: string) => {
    const { data } = await api.get(`/api/billing/admin/transactions/?tenant=${tenantId}`);
    return data.results;
  },

  // 3. Extend Subscription (God Mode)
  extendSubscription: async (subscriptionId: number, days: number) => {
    const { data } = await api.post(`/api/billing/admin/subscriptions/${subscriptionId}/extend_subscription/`, {
      days
    });
    return data;
  },

  // 4. Cancel Subscription
  cancelSubscription: async (subscriptionId: number) => {
    const { data } = await api.post(`/api/billing/admin/subscriptions/${subscriptionId}/cancel_now/`);
    return data;
  }
};