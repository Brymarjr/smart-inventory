'use client';

import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useState, ReactNode, useEffect } from 'react'; // Added useEffect
import { ThemeProvider } from '@/components/theme-provider';
import { LegalGuard } from '@/components/auth/legal-guard';

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

  return <LegalGuard>{children}</LegalGuard>;
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [mounted, setMounted] = useState(false); // ✅ Track if component has mounted

  // ✅ Set mounted to true after the first render
  useEffect(() => {
    setMounted(true);
  }, []);

  // Updated Helper: Only runs window logic after mounting
  const renderChildren = () => {
    const protectedRoutes = ['/dashboard', '/system-admin']; 

    // During SSR and the very first client render, 'mounted' is false.
    // This ensures server and client start with the same HTML.
    if (mounted && typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (protectedRoutes.some(route => path.startsWith(route))) {
        return <AuthWrapper>{children}</AuthWrapper>;
      }
    }

    return children;
  };

  return (
    <html lang="en" suppressHydrationWarning className={jakarta.variable}>
      <body className={`${jakarta.className} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              {renderChildren()} {/* ✅ Use the helper here */}
              <Toaster richColors position="top-right" />
            </AuthProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}