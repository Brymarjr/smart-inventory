'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/lib/auth-context';
import { Toaster, toast } from 'sonner';
import { useState, ReactNode, useEffect } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  // --- PWA UPDATE LOGIC ---
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const sw = navigator.serviceWorker;

      // 1. Detect when a new service worker has taken control
      sw.addEventListener('controllerchange', () => {
        // Automatically reload to ensure the new code is active
        window.location.reload();
      });

      // 2. Register/Check for updates
      sw.ready.then((registration) => {
        // Check for updates every 5 minutes
        setInterval(() => {
          registration.update();
        }, 1000 * 60 * 5);

        // Listen for the 'waiting' service worker (new code downloaded but not active)
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New content is available; show the persistent toast
                toast.info("New Version Available", {
                  description: "Updates have been downloaded. Refresh to apply changes.",
                  action: {
                    label: "Update Now",
                    onClick: () => window.location.reload(),
                  },
                  duration: Infinity, // Keep visible until they act
                });
              }
            });
          }
        });
      });
    }
  }, []);

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