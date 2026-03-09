// src/lib/api.ts
import axios from 'axios';
import { toast } from 'sonner'; // <-- ✅ Added Sonner for Global Toasts
import { SystemTenant, SystemTenantDetail, AuditLog, SupportTicket, ContactAdminPayload } from './types'; 

// Default to localhost for development
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// --- 1. Request Interceptor (INJECTS HEADERS) ---
api.interceptors.request.use(
  (config) => {
    // Inject Access Token
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Inject Active Tenant (CRITICAL FOR YOUR DASHBOARD)
    const tenantSlug = typeof window !== 'undefined' ? localStorage.getItem('tenant_slug') : null;
    if (tenantSlug) {
      config.headers['X-Tenant'] = tenantSlug;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// --- 2. Response Interceptor (HANDLES REFRESH & BILLING) ---
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // ✅ GLOBAL BILLING HANDLER: Catch Limits (402)
    if (error.response?.status === 402) {
      toast.error("Plan Limit Reached", {
        description: error.response.data.detail || "You need to upgrade your plan to perform this action.",
        duration: 8000,
        action: {
          label: "Upgrade",
          onClick: () => window.location.href = '/dashboard/billing'
        }
      });
      return Promise.reject(error);
    }
    
    // ✅ GLOBAL BILLING HANDLER: Catch Feature Locks (403)
    if (error.response?.status === 403 && error.response.data?.detail?.toLowerCase().includes('plan')) {
      toast.info("Premium Feature", {
        description: error.response.data.detail,
        duration: 8000,
      });
      return Promise.reject(error);
    }

    // Only retry if 401 Unauthorized
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null;
      const tenantSlug = typeof window !== 'undefined' ? localStorage.getItem('tenant_slug') : null;

      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_URL}/api/auth/token/refresh/`, {
            refresh: refreshToken,
          }, {
             headers: tenantSlug ? { 'X-Tenant': tenantSlug } : {} 
          });

          localStorage.setItem('access_token', data.access);
          originalRequest.headers.Authorization = `Bearer ${data.access}`;
          return api(originalRequest);
        } catch (refreshError) {
          if (typeof window !== 'undefined') {
             localStorage.clear();
             window.location.href = '/login';
          }
        }
      } else {
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

// --- 3. API MODULES ---

export const adminApi = {
  getAllTenants: async () => {
    const { data } = await api.get<SystemTenant[]>('/api/admin/tenants/');
    return data;
  },
  getTenantDetails: async (id: string) => {
    const { data } = await api.get<SystemTenantDetail>(`/api/admin/tenants/${id}/`);
    return data;
  },
  toggleTenantStatus: async (id: string) => {
    const { data } = await api.post<{ status: string; is_active: boolean }>(`/api/admin/tenants/${id}/toggle_status/`);
    return data;
  },
  getTenantAuditLogs: async (id: string, page = 1) => {
    try {
      const { data } = await api.get<{ results: AuditLog[], count: number }>(`/api/admin/tenants/${id}/audit_logs/?page=${page}`);
      return data;
    } catch (error: any) {
      // Catch the billing lock
      if (error.response?.status === 403) {
        return { isLocked: true, message: error.response.data?.detail };
      }
      throw error;
    }
  },
  getTenantSubscription: async (tenantId: string) => {
    const { data } = await api.get(`/api/billing/admin/subscriptions/?tenant=${tenantId}`);
    return data.results && data.results.length > 0 ? data.results[0] : null;
  },
  getTenantTransactions: async (tenantId: string) => {
    const { data } = await api.get(`/api/billing/admin/transactions/?tenant=${tenantId}`);
    return data.results;
  },
  extendSubscription: async (subscriptionId: number, days: number) => {
    const { data } = await api.post(`/api/billing/admin/subscriptions/${subscriptionId}/extend_subscription/`, { days });
    return data;
  },
  cancelSubscription: async (subscriptionId: number) => {
    const { data } = await api.post(`/api/billing/admin/subscriptions/${subscriptionId}/cancel_now/`);
    return data;
  },

  getSystemAnalytics: async () => {
    const { data } = await api.get('/api/admin/analytics/');
    return data;
  }
};

export const supportApi = {
  // TIER 1: Staff -> Tenant Admin
  contactTenantAdmin: async (payload: ContactAdminPayload) => {
    const { data } = await api.post('/api/support/contact-admin/', payload);
    return data;
  },

  // TIER 2: Admin -> System Support
  createTicket: async (payload: Partial<SupportTicket>) => {
    const { data } = await api.post<SupportTicket>('/api/support/tickets/', payload);
    return data;
  },

  getMyTickets: async () => {
    const { data } = await api.get('/api/support/tickets/');
    // If paginated, return results. If flat array (rare), return data.
    return Array.isArray(data) ? data : data.results;
  },
  
  getAllTickets: async () => {
    const { data } = await api.get('/api/support/tickets/');
    return Array.isArray(data) ? data : data.results;
  },

  updateTicket: async (id: number, payload: Partial<SupportTicket>) => {
    const { data } = await api.patch<SupportTicket>(`/api/support/tickets/${id}/`, payload);
    return data;
  },

  replyToTicket: async (id: number, message: string) => {
    const { data } = await api.post(`/api/support/tickets/${id}/reply/`, { message });
    return data;
  },

};