'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getDisplayUsername } from '@/lib/utils'; 
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Truck, 
  CreditCard, 
  Users, 
  LogOut, 
  Menu,
  TrendingUp, 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

//  IMPORT THE NEW NOTIFICATION COMPONENT
import { NotificationsBell } from '@/components/layout/notifications-bell';

// Navigation Items Configuration
const NAV_ITEMS = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Analytics', href: '/dashboard/analytics', icon: TrendingUp }, 
  { name: 'Inventory', href: '/dashboard/inventory', icon: Package },
  { name: 'Sales', href: '/dashboard/sales', icon: ShoppingCart },
  { name: 'Purchases', href: '/dashboard/purchases', icon: Truck },
  { name: 'Billing', href: '/dashboard/billing', icon: CreditCard },
  { name: 'Users & Roles', href: '/dashboard/users', icon: Users },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // =========================================================
  //  SECURITY & ENFORCER LOGIC
  // =========================================================
  useEffect(() => {
    // 1. Wait for auth to initialize
    if (isLoading) return;

    // 2. Protection: Kick out unauthenticated users
    if (!user) {
      router.push('/login');
      return;
    }

    // 3. Enforcer: Trap users who must change password
    if (user.must_change_password) {
      if (pathname !== '/dashboard/change-password') {
        router.replace('/dashboard/change-password');
      }
    }

  }, [user, isLoading, router, pathname]);

  // Loading State
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-12 w-12 bg-gray-200 rounded-full mb-4"></div>
          <div className="h-4 w-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  // Prevent flash of content if user is missing (redirecting)
  if (!user) return null;

  return (
    <div className="flex h-screen bg-gray-50/50">
      
      {/* --- DESKTOP SIDEBAR --- */}
      <aside className="hidden md:flex w-64 flex-col bg-white border-r">
        <div className="h-16 flex items-center px-6 border-b">
          <Package className="w-6 h-6 text-primary mr-2" />
          <span className="text-lg font-bold text-gray-900">Smart Inventory</span>
        </div>
        
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  isActive 
                    ? 'bg-primary/10 text-primary' 
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <item.icon className={`mr-3 h-5 w-5 ${isActive ? 'text-primary' : 'text-slate-400'}`} />
                {item.name}
              </Link>
            );
          })}
        </div>

        <div className="p-4 border-t bg-gray-50/50">
          <div className="flex items-center gap-3">
             <Avatar className="h-9 w-9 border">
                <AvatarImage src={`https://ui-avatars.com/api/?name=${user.username}&background=random`} />
                <AvatarFallback>
                  {getDisplayUsername(user.username).substring(0,2).toUpperCase()}
                </AvatarFallback>
             </Avatar>
             <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user.first_name || getDisplayUsername(user.username)}
                </p>
                <p className="text-xs text-gray-500 truncate capitalize">
                  {user.is_superuser ? 'System Admin' : user.role || 'User'}
                </p>
             </div>
          </div>
        </div>
      </aside>

      {/* --- MAIN CONTENT AREA --- */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b flex items-center justify-between px-4 md:px-6">
          <div className="md:hidden">
              {/* Mobile Sidebar Trigger */}
              <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Menu className="h-6 w-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 p-0">
                   <div className="h-16 flex items-center px-6 border-b">
                     <span className="text-lg font-bold">Smart Inventory</span>
                   </div>
                   <div className="py-4 px-3 space-y-1">
                     {NAV_ITEMS.map((item) => (
                       <Link
                         key={item.href}
                         href={item.href}
                         onClick={() => setIsMobileOpen(false)}
                         className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                           pathname === item.href ? 'bg-secondary' : 'hover:bg-secondary/50'
                         }`}
                       >
                         <item.icon className="mr-3 h-5 w-5" />
                         {item.name}
                       </Link>
                     ))}
                   </div>
                </SheetContent>
              </Sheet>
          </div>
          
          {/* Header Right Side */}
          <div className="flex items-center gap-4 ml-auto">
              {/* REPLACED HARDCODED BUTTON WITH COMPONENT */}
              <NotificationsBell />

              <DropdownMenu>
               <DropdownMenuTrigger asChild>
                 <Button variant="ghost" size="icon" className="rounded-full">
                   <Avatar className="h-8 w-8">
                     <AvatarFallback>U</AvatarFallback>
                   </Avatar>
                 </Button>
               </DropdownMenuTrigger>
               <DropdownMenuContent align="end">
                 <DropdownMenuLabel>My Account</DropdownMenuLabel>
                 <DropdownMenuSeparator />
                 <DropdownMenuItem>Profile</DropdownMenuItem>
                 <DropdownMenuItem>Settings</DropdownMenuItem>
                 <DropdownMenuSeparator />
                 <DropdownMenuItem onClick={logout} className="text-red-600 cursor-pointer">
                   <LogOut className="mr-2 h-4 w-4" />
                   Logout
                 </DropdownMenuItem>
               </DropdownMenuContent>
              </DropdownMenu>
          </div>
        </header>

        {/* Page Content Injection */}
        <main className="flex-1 overflow-auto p-4 md:p-8">
           <div className="max-w-7xl mx-auto">
             {children}
           </div>
        </main>
      </div>
    </div>
  );
}