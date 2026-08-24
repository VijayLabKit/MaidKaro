"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWorkerAuth } from "@/lib/worker-auth-context";

export function useRequireWorkerAuth() {
  const { worker, isLoading } = useWorkerAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !worker) {
      router.push("/worker/login");
    }
  }, [isLoading, worker, router]);

  return { worker, isLoading };
}
