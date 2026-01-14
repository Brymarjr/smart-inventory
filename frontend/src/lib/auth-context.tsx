'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import api from './api';
import { useRouter } from 'next/navigation';
import { User, AuthResponse } from './types';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  loginTenant: (tenant: string, username: string, password: string) => Promise<void>;
  loginAdmin: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Helper function to fetch user data
  const fetchUserProfile = async () => {
    try {
      const { data } = await api.get('/api/users/me/');
      setUser(data);
    } catch (error: any) {
      console.error('Failed to fetch user profile:', error);
      
      // ✅ FIX: Only logout if it is a 401 Unauthorized
      if (error.response && error.response.status === 401) {
          console.warn('Session expired, logging out.');
          logout();
      } else {
         // If it's another error (like 500 or network), just don't set the user, 
         // but don't kick them out immediately to allow for retries.
         toast.error("Connection error. Please refresh.");
      }
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('access_token');
      // Only try to fetch if we actually have a token
      if (token) {
        await fetchUserProfile();
      }
      setIsLoading(false);
    };
    initAuth();
  }, []);

  const refreshUser = async () => {
    await fetchUserProfile();
  };

  const loginTenant = async (tenant: string, username: string, password: string) => {
    const { data } = await api.post<AuthResponse>('/api/login/', {
      tenant,
      username,
      password,
    });

    localStorage.setItem('access_token', data.access);
    localStorage.setItem('refresh_token', data.refresh);
    // ✅ This is crucial for the API interceptor
    localStorage.setItem('tenant_slug', tenant); 

    setUser(data.user); 
    router.push('/dashboard');
  };

 const loginAdmin = async (username: string, password: string) => {
    try {
      const { data } = await api.post<AuthResponse>('/api/auth/token/', {
        username,
        password,
      });

      // Explicitly passing header here because interceptor might not be ready or we want to be safe
      const userRes = await api.get<User>('/api/users/me/', {
        headers: { Authorization: `Bearer ${data.access}` }
      });

      const userProfile = userRes.data;

      if (!userProfile.is_superuser) {
        throw new Error("Unauthorized: You do not have System Admin access.");
      }

      localStorage.setItem('access_token', data.access);
      localStorage.setItem('refresh_token', data.refresh);
      localStorage.removeItem('tenant_slug'); // Admins don't have a tenant context

      setUser(userProfile);
      router.push('/system-admin'); 

    } catch (error) {
      console.error("Admin Login Failed", error);
      localStorage.removeItem('access_token'); 
      localStorage.removeItem('refresh_token');
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('tenant_slug');
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loginTenant, loginAdmin, logout, refreshUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};