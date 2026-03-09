"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";

export function LegalGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // 1. Wait for auth to load
    if (isLoading) return;

    // 2. If not logged in, skip
    if (!user) return;

    const legalPath = "/legal/accept-terms";

    // 3. CHECK: Has user accepted ToS?
    if (!user.tos_accepted_at) {
      // If NOT accepted, and NOT on the legal page -> Force Redirect to Legal Page
      if (pathname !== legalPath) {
        router.replace(legalPath);
      }
    } else {
      // If ALREADY accepted, and trying to view legal page -> Send to Dashboard
      if (pathname === legalPath) {
        router.replace("/dashboard");
      }
    }
  }, [user, isLoading, pathname, router]);

  // Show loading spinner while checking status to prevent "flash" of content
  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-card dark:bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return <>{children}</>;
}
