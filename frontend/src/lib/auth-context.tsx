'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import api from './api';
import { useRouter } from 'next/navigation';
import { User, AuthResponse } from './types';

interface AuthContextType {
  user: User | null;
  loginTenant: (tenant: string, username: string, password: string) => Promise<void>;
  loginAdmin: (username: string, password: string) => Promise<void>;
  logout: () => void;
  // Added this so we can manually reload the user profile
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
      // This endpoint works for both Admins and Tenants
      const { data } = await api.get('/api/users/me/');
      setUser(data);
    } catch (error) {
      console.error('Session invalid, logging out');
      logout();
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        await fetchUserProfile();
      }
      setIsLoading(false);
    };
    initAuth();
  }, []);

  // Exposed function to force a profile refresh
  const refreshUser = async () => {
    await fetchUserProfile();
  };

  const loginTenant = async (tenant: string, username: string, password: string) => {
    // Hits your custom TenantAwareAuthViewSet
    const { data } = await api.post<AuthResponse>('/api/login/', {
      tenant,
      username,
      password,
    });

    localStorage.setItem('access_token', data.access);
    localStorage.setItem('refresh_token', data.refresh);
    localStorage.setItem('tenant_slug', tenant); // CRITICAL: Saved for headers

    // Use the user object directly from response (saves a network call)
    setUser(data.user); 
    router.push('/dashboard');
  };

 const loginAdmin = async (username: string, password: string) => {
    try {
      // 1. Login to get the Token
      const { data } = await api.post<AuthResponse>('/api/auth/token/', {
        username,
        password,
      });

      // 2. Fetch the User Profile immediately to check who they are
      // We pass the new token in the header manually for this request
      const userRes = await api.get<User>('/api/users/me/', {
        headers: { Authorization: `Bearer ${data.access}` }
      });

      const userProfile = userRes.data;

      // 3. SECURITY CHECK: The "Bouncer"
      // If a normal tenant tries to log in via the Admin tab, we stop them here.
      if (!userProfile.is_superuser) {
        throw new Error("Unauthorized: You do not have System Admin access.");
      }

      // 4. Save Session
      localStorage.setItem('access_token', data.access);
      localStorage.setItem('refresh_token', data.refresh);
      localStorage.removeItem('tenant_slug'); // Clear tenant data so we don't get mixed up

      setUser(userProfile);

      // 5. ROUTING
      // Send them to the new System Admin area
      router.push('/system-admin'); 

    } catch (error) {
      console.error("Admin Login Failed", error);
      // Safety: Clear any tokens if the checks failed
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