'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from './api';
import { User, AuthResponse } from './types';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  loginTenant: (tenant: string, email: string, password: string) => Promise<void>;
  loginAdmin: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<User | undefined>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    // 1. Grab the info from the current user state directly without making the whole function depend on 'user'
    // We use a temporary variable so we don't need 'user' in the dependency array
    const token = localStorage.getItem('access_token');
    
    // 2. Wipe EVERYTHING
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('tenant_slug');
    localStorage.removeItem('username');
    
    // We check if we're on a system-admin path OR if the user was an admin 
    // to decide where to send them
    const isAdminPath = window.location.pathname.startsWith('/system-admin');

    setUser(null);

    // 3. Conditional Redirect
    if (isAdminPath) {
      window.location.href = '/system-admin/login';
    } else {
      window.location.href = '/login';
    }
  }, []); // ✅ EMPTY ARRAY = NO MORE LOOPS

  const fetchUserProfile = useCallback(async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (!token) {
      setUser(null);
      return;
    }

    try {
      const { data } = await api.get<User>('/api/users/me/');
      setUser(data);
      return data; 
    } catch (error: any) {
      if (error.response?.status === 401) {
        logout();
      }
      return undefined;
    }
  }, [logout]);

  useEffect(() => {
    const init = async () => {
      await fetchUserProfile();
      setIsLoading(false);
    };
    init();
  }, [fetchUserProfile]);

  const refreshUser = async () => {
    return await fetchUserProfile();
  };

  const loginTenant = async (tenant: string, email: string, password: string) => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('tenant_slug');
    localStorage.removeItem('username');

    const safeTenantSlug = tenant.toLowerCase().trim().replace(/\s+/g, '-');

    try {
      const { data } = await api.post<AuthResponse>('/api/login/', { 
        tenant: safeTenantSlug, 
        tenant_slug: safeTenantSlug,
        username: email, 
        email: email,
        password: password 
      });

      localStorage.setItem('access_token', data.access);
      localStorage.setItem('refresh_token', data.refresh);
      localStorage.setItem('tenant_slug', safeTenantSlug);
      localStorage.setItem('username', email); 

      setUser(data.user);

      if (!data.user.tos_accepted_at) {
        window.location.href = '/legal/accept-terms';
      } else {
        window.location.href = '/dashboard';
      }

      toast.success('Access Granted');
    } catch (error: any) {
      let message = 'Login failed. Please check your credentials.';
      if (error.response?.data?.detail) message = error.response.data.detail;
      throw new Error(message);
    }
  };

  const loginAdmin = async (username: string, password: string) => {
    try {
      const { data } = await api.post<AuthResponse>('/api/auth/token/', { username, password });
      const userRes = await api.get<User>('/api/users/me/', {
        headers: { Authorization: `Bearer ${data.access}` }
      });

      if (!userRes.data.is_superuser) throw new Error('Unauthorized');

      localStorage.setItem('access_token', data.access);
      localStorage.setItem('refresh_token', data.refresh);
      localStorage.setItem('username', username); 
      setUser(userRes.data);
      window.location.href = '/system-admin'; 
    } catch (error: any) {
      throw new Error('Admin login failed');
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, loginTenant, loginAdmin, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};