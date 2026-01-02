'use client';

import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { useState } from "react";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Create client once per session to avoid re-initializing on re-renders
  const [queryClient] = useState(() => new QueryClient());

  return (
    <html lang="en">
      <body className={inter.className}>
         <QueryClientProvider client={queryClient}>
           <AuthProvider>
              {children}
              <Toaster />
           </AuthProvider>
         </QueryClientProvider>
      </body>
    </html>
  );
}