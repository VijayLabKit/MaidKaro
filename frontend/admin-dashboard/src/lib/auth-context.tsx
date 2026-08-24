'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from './api';

interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  role: 'ADMIN' | 'SUPER_ADMIN';
  staffRole: 'SUPER_ADMIN' | 'OPERATIONS' | 'VERIFICATION' | 'SUPPORT' | 'FINANCE';
}

interface AuthContextValue {
  admin: AdminUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEYS = {
  access: 'maidkaro_admin_access_token',
  refresh: 'maidkaro_admin_refresh_token',
  admin: 'maidkaro_admin_profile',
};

interface AdminLoginResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  fullName: string;
  email: string;
  role: 'ADMIN' | 'SUPER_ADMIN';
  staffRole: 'SUPER_ADMIN' | 'OPERATIONS' | 'VERIFICATION' | 'SUPPORT' | 'FINANCE';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.admin);
    if (stored) setAdmin(JSON.parse(stored));
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiFetch<AdminLoginResponse>('/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    const profile: AdminUser = {
      id: email,
      fullName: result.fullName,
      email: result.email,
      role: result.role || (email.includes('admin@') ? 'SUPER_ADMIN' : 'ADMIN'),
      staffRole: result.staffRole,
    };

    localStorage.setItem(STORAGE_KEYS.access, result.accessToken);
    if (result.refreshToken) {
      localStorage.setItem(STORAGE_KEYS.refresh, result.refreshToken);
    }
    localStorage.setItem(STORAGE_KEYS.admin, JSON.stringify(profile));
    setAdmin(profile);
    router.push('/dashboard');
  }, [router]);

  function logout() {
    localStorage.removeItem(STORAGE_KEYS.access);
    localStorage.removeItem(STORAGE_KEYS.refresh);
    localStorage.removeItem(STORAGE_KEYS.admin);
    setAdmin(null);
    router.push('/login');
  }

  return <AuthContext.Provider value={{ admin, isLoading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
