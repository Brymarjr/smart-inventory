'use client';

import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner"; 
import { useState } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { LegalGuard } from "@/components/auth/legal-guard"; // ✅ Import the Guard

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Create client once per session to avoid re-initializing on re-renders
  const [queryClient] = useState(() => new QueryClient());

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
        >
            <QueryClientProvider client={queryClient}>
                <AuthProvider>
                    {/* ✅ LegalGuard is placed here so it can access the user from AuthProvider */}
                    <LegalGuard>
                        {children}
                    </LegalGuard>
                    
                    <Toaster />
                </AuthProvider>
            </QueryClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}