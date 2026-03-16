'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/lib/auth-context';
import { Toaster } from 'sonner';
import { useState, ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  // Safe initialization of QueryClient
  const [queryClient] = useState(() => new QueryClient());

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {children}
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}