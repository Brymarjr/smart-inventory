'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldAlert, LogOut, Moon, Sun, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "next-themes"; // Ensure you have next-themes installed

export default function SystemAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading, logout } = useAuth(); // Get logout function
  const router = useRouter();
  const { setTheme, theme } = useTheme(); // Theme hook
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch for theme
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      if (!user || !user.is_superuser) {
        router.push('/login?error=unauthorized');
      }
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user?.is_superuser) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* --- TOP NAVIGATION BAR --- */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center px-6 justify-between">
          
          {/* Left: Logo/Brand */}
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 p-2 rounded-lg">
                <ShieldAlert className="h-6 w-6 text-primary" />
            </div>
            <div>
                <h1 className="font-bold text-lg leading-none tracking-tight">System Core</h1>
                <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                    {user.is_staff ? 'Full Access' : 'Read Only'}
                </span>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-4">
            
            {/* Theme Toggle */}
            {mounted && (
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                >
                    {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </Button>
            )}

            {/* User Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                   <User className="h-4 w-4" />
                   <span className="hidden md:inline">{user.username}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-red-600 cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* --- MAIN CONTENT --- */}
      <main className="p-6 md:p-8 max-w-7xl mx-auto">
        {children}
      </main>
    </div>
  );
}