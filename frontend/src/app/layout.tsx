'use client';

import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useState, ReactNode, useEffect } from 'react';
import { ThemeProvider } from '@/components/theme-provider';
import { LegalGuard } from '@/components/auth/legal-guard';
import { IdleTimeoutWrapper } from '@/components/auth/idle-timeout-wrapper';

const jakarta = Plus_Jakarta_Sans({ 
  subsets: ['latin'],
  variable: '--font-jakarta', 
});

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

  return (
    <LegalGuard>
      <IdleTimeoutWrapper>
        {children}
      </IdleTimeoutWrapper>
    </LegalGuard>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Updated Helper: Handles route protection and hydration safety
  const renderChildren = () => {
    const protectedRoutes = ['/dashboard', '/system-admin']; 

    if (mounted && typeof window !== 'undefined') {
      const path = window.location.pathname;

      // Explicitly exempt the system admin login page from the wrapper
      if (path === '/system-admin/login') {
        return children;
      }

      if (protectedRoutes.some(route => path.startsWith(route))) {
        return <AuthWrapper>{children}</AuthWrapper>;
      }
    }

    return children;
  };

  return (
    <html lang="en" suppressHydrationWarning className={jakarta.variable}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <title>ForeTrack</title>
        <meta name="description" content="Smart POS and Inventory Management" />
      </head>
      <body className={`${jakarta.className} antialiased bg-background text-foreground`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              {renderChildren()}
              <Toaster richColors position="top-right" />
            </AuthProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}