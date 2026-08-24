"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import {
  registerWorker as apiRegisterWorker,
  loginWorker as apiLoginWorker,
  forgotPasswordWorker as apiForgotPasswordWorker,
  resetPasswordWorker as apiResetPasswordWorker,
  getMyWorkerProfile,
  getWorkerTokens,
  setWorkerTokens,
  clearWorkerTokens,
  WorkerProfileMe,
} from "./worker-api";

interface WorkerAuthContextValue {
  worker: WorkerProfileMe | null;
  isLoading: boolean;
  registerWorker: (payload: {
    full_name: string; email: string; phone: string; password: string; confirm_password: string;
    city_id: string; years_experience: number; languages: string[];
  }) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<{ devToken: string | null }>;
  resetPassword: (token: string, newPassword: string, confirmPassword: string) => Promise<void>;
  logout: () => void;
  refreshWorker: () => Promise<void>;
}

const WorkerAuthContext = createContext<WorkerAuthContextValue | undefined>(undefined);

export function WorkerAuthProvider({ children }: { children: ReactNode }) {
  const [worker, setWorker] = useState<WorkerProfileMe | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadWorker = useCallback(async () => {
    const tokens = getWorkerTokens();
    if (!tokens) {
      setWorker(null);
      setIsLoading(false);
      return;
    }
    try {
      const profile = await getMyWorkerProfile();
      setWorker(profile);
    } catch {
      clearWorkerTokens();
      setWorker(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorker();
  }, [loadWorker]);

  async function registerWorker(payload: {
    full_name: string; email: string; phone: string; password: string; confirm_password: string;
    city_id: string; years_experience: number; languages: string[];
  }) {
    const tokenPair = await apiRegisterWorker(payload);
    setWorkerTokens({
      accessToken: tokenPair.access_token, refreshToken: tokenPair.refresh_token,
      role: tokenPair.role, userId: tokenPair.user_id,
    });
    await loadWorker();
  }

  async function login(email: string, password: string) {
    const tokenPair = await apiLoginWorker(email, password);
    setWorkerTokens({
      accessToken: tokenPair.access_token, refreshToken: tokenPair.refresh_token,
      role: tokenPair.role, userId: tokenPair.user_id,
    });
    await loadWorker();
  }

  async function forgotPassword(email: string) {
    const result = await apiForgotPasswordWorker(email);
    return { devToken: result.dev_reset_token };
  }

  async function resetPassword(token: string, newPassword: string, confirmPassword: string) {
    await apiResetPasswordWorker(token, newPassword, confirmPassword);
  }

  function logout() {
    clearWorkerTokens();
    setWorker(null);
  }

  return (
    <WorkerAuthContext.Provider value={{
      worker, isLoading, registerWorker, login, forgotPassword, resetPassword, logout, refreshWorker: loadWorker,
    }}>
      {children}
    </WorkerAuthContext.Provider>
  );
}

export function useWorkerAuth() {
  const ctx = useContext(WorkerAuthContext);
  if (!ctx) throw new Error("useWorkerAuth must be used within WorkerAuthProvider");
  return ctx;
}
