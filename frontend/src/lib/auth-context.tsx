'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from './api';
import { useRouter } from 'next/navigation';
import { User, AuthResponse } from './types';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  loginTenant: (tenant: string, email: string, password: string) => Promise<void>;
  loginAdmin: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const logout = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('tenant_slug');
    setUser(null);
    router.push('/login');
  }, [router]);

  const fetchUserProfile = useCallback(async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (!token) {
      setUser(null);
      return;
    }

    try {
      const { data } = await api.get<User>('/api/users/me/');
      setUser(data);
    } catch (error: any) {
      if (error.response?.status === 401) {
        logout();
      }
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
    await fetchUserProfile();
  };

  // =====================
  // TENANT LOGIN - FIXED
  // =====================
  const loginTenant = async (tenant: string, email: string, password: string) => {
    try {
      // 1. We use the trailing slash /api/login/ - Django requires this.
      // 2. We send redundant keys (tenant & tenant_slug) to pass backend validation.
      const { data } = await api.post<AuthResponse>('/api/login/', { 
        tenant: tenant, 
        tenant_slug: tenant,
        username: email, // Sending email as username key for Django's authenticate()
        email: email,
        password: password 
      });

      localStorage.setItem('access_token', data.access);
      localStorage.setItem('refresh_token', data.refresh);
      localStorage.setItem('tenant_slug', tenant);

      setUser(data.user);
      router.push('/dashboard');
      
      toast.success('Access Granted', { description: `Welcome to ${tenant}` });

    } catch (error: any) {
      // FIX: Handle cases where the server is unreachable (undefined error.response)
      if (!error.response) {
        console.error('NETWORK ERROR: Django server is unreachable or CORS is blocking the request.');
        throw new Error('Connection failed. Please check if your backend is running.');
      }

      const serverData = error.response.data;
      console.error('SERVER ERROR DETAILS:', serverData);
      
      // Extract specific error messages (e.g., "Account not found")
      let message = 'Login failed. Please check your credentials.';
      if (serverData?.detail) message = serverData.detail;
      else if (serverData?.non_field_errors) message = serverData.non_field_errors[0];
      
      throw new Error(message);
    }
  };

  const loginAdmin = async (username: string, password: string) => {
    try {
      const { data } = await api.post<AuthResponse>('/api/auth/token/', { username, password });
      const userRes = await api.get<User>('/api/users/me/', {
        headers: { Authorization: `Bearer ${data.access}` }
      });

      if (!userRes.data.is_superuser) {
        throw new Error('Unauthorized: System Admin access required.');
      }

      localStorage.setItem('access_token', data.access);
      localStorage.setItem('refresh_token', data.refresh);
      setUser(userRes.data);
      router.push('/system-admin');
    } catch (error: any) {
      throw new Error(error?.response?.data?.detail || 'Admin login failed');
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