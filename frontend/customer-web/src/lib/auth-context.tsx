"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { AppUser } from "./types";
import {
  requestOtp as apiRequestOtp,
  verifyOtp as apiVerifyOtp,
  registerCustomer as apiRegisterCustomer,
  loginWithPassword as apiLoginWithPassword,
  forgotPassword as apiForgotPassword,
  resetPassword as apiResetPassword,
  getMyProfile,
  getStoredTokens,
  setStoredTokens,
  clearStoredTokens,
} from "./api";

interface AuthContextValue {
  user: AppUser | null;
  isLoading: boolean;
  requestOtp: (phone: string) => Promise<{ devOtp: string | null }>;
  verifyOtp: (phone: string, otp: string, fullName?: string, email?: string) => Promise<void>;
  registerCustomer: (fullName: string, email: string, phone: string, password: string, confirmPassword: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<{ devToken: string | null }>;
  resetPassword: (token: string, newPassword: string, confirmPassword: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function formatE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) {
    return `+${digits}`;
  }
  return `+91${digits.slice(-10)}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const tokens = getStoredTokens();
    if (!tokens) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const profile = await getMyProfile();
      setUser({
        id: profile.id,
        fullName: profile.full_name,
        phone: profile.phone.replace(/^\+91/, ""),
        email: profile.email ?? undefined,
      });
    } catch {
      // token invalid/expired — clear it so the person is prompted to log in again
      clearStoredTokens();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  async function requestOtp(phone: string) {
    const formatted = formatE164(phone);
    const result = await apiRequestOtp(formatted, "LOGIN");
    return { devOtp: result.dev_otp };
  }

  async function verifyOtp(phone: string, otp: string, fullName?: string, email?: string) {
    const formatted = formatE164(phone);
    const tokenPair = await apiVerifyOtp(formatted, otp, fullName, email);
    setStoredTokens({
      accessToken: tokenPair.access_token,
      refreshToken: tokenPair.refresh_token,
      role: tokenPair.role,
      userId: tokenPair.user_id,
    });
    await loadUser();
  }

  async function registerCustomer(fullName: string, email: string, phone: string, password: string, confirmPassword: string) {
    const formatted = formatE164(phone);
    const tokenPair = await apiRegisterCustomer({
      full_name: fullName, email, phone: formatted, password, confirm_password: confirmPassword,
    });
    setStoredTokens({
      accessToken: tokenPair.access_token,
      refreshToken: tokenPair.refresh_token,
      role: tokenPair.role,
      userId: tokenPair.user_id,
    });
    await loadUser();
  }

  async function login(email: string, password: string) {
    const tokenPair = await apiLoginWithPassword(email, password, "CUSTOMER");
    setStoredTokens({
      accessToken: tokenPair.access_token,
      refreshToken: tokenPair.refresh_token,
      role: tokenPair.role,
      userId: tokenPair.user_id,
    });
    await loadUser();
  }

  async function forgotPassword(email: string) {
    const result = await apiForgotPassword(email);
    return { devToken: result.dev_reset_token };
  }

  async function resetPassword(token: string, newPassword: string, confirmPassword: string) {
    await apiResetPassword(token, newPassword, confirmPassword);
  }

  function logout() {
    clearStoredTokens();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{
      user, isLoading, requestOtp, verifyOtp, registerCustomer, login, forgotPassword, resetPassword,
      logout, refreshUser: loadUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
