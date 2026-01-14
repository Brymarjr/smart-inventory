'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter, usePathname } from 'next/navigation'; // ✅ Added usePathname for active state
import Link from 'next/link'; // ✅ Added Link
import { Loader2, ShieldAlert, LogOut, Moon, Sun, User, LifeBuoy, LayoutDashboard } from 'lucide-react'; // ✅ Added Icons
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "next-themes";

export default function SystemAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname(); // ✅ Get current URL to highlight active button
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

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
          
          <div className="flex items-center gap-8">
            {/* 1. BRAND LOGO */}
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

            {/* 2. ✅ NEW: MAIN NAVIGATION LINKS */}
            <nav className="hidden md:flex items-center gap-1 border-l pl-6 h-8">
               <Link href="/system-admin">
                 <Button 
                    variant={pathname === '/system-admin' ? 'secondary' : 'ghost'} 
                    size="sm"
                    className="gap-2"
                 >
                    <LayoutDashboard className="h-4 w-4" />
                    Tenants
                 </Button>
               </Link>

               <Link href="/system-admin/support">
                 <Button 
                    variant={pathname?.includes('/support') ? 'secondary' : 'ghost'} 
                    size="sm"
                    className="gap-2"
                 >
                    <LifeBuoy className="h-4 w-4" />
                    Support Desk
                 </Button>
               </Link>
            </nav>
          </div>

          {/* 3. RIGHT ACTIONS */}
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