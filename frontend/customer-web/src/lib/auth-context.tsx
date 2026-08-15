"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { AppUser } from "./types";
import {
  requestOtp as apiRequestOtp,
  verifyOtp as apiVerifyOtp,
  getMyProfile,
  getStoredTokens,
  setStoredTokens,
  clearStoredTokens,
} from "./api";

interface AuthContextValue {
  user: AppUser | null;
  isLoading: boolean;
  requestOtp: (phone: string) => Promise<{ devOtp: string | null }>;
  verifyOtp: (phone: string, otp: string, fullName?: string) => Promise<void>;
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

  async function verifyOtp(phone: string, otp: string, fullName?: string) {
    const formatted = formatE164(phone);
    const tokenPair = await apiVerifyOtp(formatted, otp, fullName);
    setStoredTokens({
      accessToken: tokenPair.access_token,
      refreshToken: tokenPair.refresh_token,
      role: tokenPair.role,
      userId: tokenPair.user_id,
    });
    await loadUser();
  }

  function logout() {
    clearStoredTokens();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, requestOtp, verifyOtp, logout, refreshUser: loadUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
