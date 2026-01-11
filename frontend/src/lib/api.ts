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