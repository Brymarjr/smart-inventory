'use client';

import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner"; // Changed import to match standard sonner usage if needed, or keep your component wrapper
// If you have a custom component wrapper for toaster:
// import { Toaster } from "@/components/ui/sonner"; 
import { useState } from "react";
import { ThemeProvider } from "@/components/theme-provider"; // ✅ Import this

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Create client once per session to avoid re-initializing on re-renders
  const [queryClient] = useState(() => new QueryClient());

  return (
    // ✅ 1. Add suppressHydrationWarning
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        {/* ✅ 2. Wrap everything in ThemeProvider */}
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
        >
            <QueryClientProvider client={queryClient}>
                <AuthProvider>
                    {children}
                    <Toaster />
                </AuthProvider>
            </QueryClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}