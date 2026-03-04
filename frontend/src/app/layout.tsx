'use client';

import { Plus_Jakarta_Sans } from 'next/font/google'; // Switched from Inter to Plus Jakarta Sans
import './globals.css';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useState, ReactNode } from 'react';
import { ThemeProvider } from '@/components/theme-provider';
import { LegalGuard } from '@/components/auth/legal-guard';
import { IdleTimeoutWrapper } from '@/components/auth/idle-timeout-wrapper';

// Configured Plus Jakarta Sans for a softer, more premium SME feel
const jakarta = Plus_Jakarta_Sans({ 
  subsets: ['latin'],
  variable: '--font-jakarta', 
});

// ----------------------
// Guard Wrapper for Auth-Only Pages
// ----------------------
function AuthWrapper({ children }: { children: ReactNode }) {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-background">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm font-bold text-primary animate-pulse">Initializing ForeTrack...</p>
        </div>
      </div>
    );
  }

  // Now every protected page has an inactivity timer!
  return (
    <LegalGuard>
      <IdleTimeoutWrapper>
        {children}
      </IdleTimeoutWrapper>
    </LegalGuard>
  );
}

// ----------------------
// RootLayout
// ----------------------
export default function RootLayout({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <html lang="en" suppressHydrationWarning className={jakarta.variable}>
      <body className={`${jakarta.className} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light" // Defaulting to light for SME visibility
          enableSystem
          disableTransitionOnChange
        >
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              {/* ✅ Only wrap pages that need authentication */}
              {childrenWithAuth(children)}
              <Toaster richColors position="top-right" />
            </AuthProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

// ----------------------
// Helper: Wrap only protected pages with AuthWrapper
// ----------------------
function childrenWithAuth(children: ReactNode) {
  const protectedRoutes = ['/dashboard', '/system-admin']; 

  if (typeof window !== 'undefined') {
    const path = window.location.pathname;
    if (protectedRoutes.some(route => path.startsWith(route))) {
      return <AuthWrapper>{children}</AuthWrapper>;
    }
  }

  return children;
}