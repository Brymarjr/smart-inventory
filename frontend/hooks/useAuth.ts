// frontend/hooks/useAuth.ts
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken, clearTokens } from "@/lib/auth";

export function useAuth(redirectIfUnauthenticated = true) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const token = getAccessToken();

    if (token) {
      setIsAuthenticated(true);
    } else if (redirectIfUnauthenticated) {
      router.push("/login");
    }
  }, [router, redirectIfUnauthenticated]);

  const logout = () => {
    clearTokens();
    router.push("/login");
  };

  return { isAuthenticated, logout };
}
