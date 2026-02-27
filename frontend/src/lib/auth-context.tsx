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
    // Wipe EVERYTHING on logout
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('tenant_slug');
    localStorage.removeItem('username');
    setUser(null);
    window.location.href = '/login'; // 🛑 HARD REDIRECT
  }, []);

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
    // 1. PRE-EMPTIVE STRIKE: Wipe any "ghost" data from previous sessions before starting
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('tenant_slug');
    localStorage.removeItem('username');

    // 2. BULLETPROOF FORMATTING: Force the ID into a proper slug
    const safeTenantSlug = tenant.toLowerCase().trim().replace(/\s+/g, '-');

    try {
      const { data } = await api.post<AuthResponse>('/api/login/', { 
        tenant: safeTenantSlug, 
        tenant_slug: safeTenantSlug,
        username: email, 
        email: email,
        password: password 
      });

      // 3. Save the clean data, including the username
      localStorage.setItem('access_token', data.access);
      localStorage.setItem('refresh_token', data.refresh);
      localStorage.setItem('tenant_slug', safeTenantSlug);
      localStorage.setItem('username', email); 

      setUser(data.user);

      // 4. Smart Redirect (HARD NAVIGATION)
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
      window.location.href = '/system-admin'; // 🛑 HARD REDIRECT
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