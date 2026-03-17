"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getDisplayUsername } from '@/lib/utils';
import { useSync } from '@/hooks/use-sync';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Truck, 
  CreditCard, 
  Users, 
  Menu,
  TrendingUp,
  Loader2,
  WifiOff,
  PackageSearch 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Sheet, 
  SheetContent, 
  SheetTrigger, 
  SheetTitle,
  SheetDescription
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

import { NotificationsBell } from "@/components/layout/notifications-bell";
import { UserNav } from "@/components/layout/user-nav";

const NAV_ITEMS = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Analytics", href: "/dashboard/analytics", icon: TrendingUp },
  { name: "Inventory", href: "/dashboard/inventory/suppliers", icon: Package },
  { name: "Sales", href: "/dashboard/sales", icon: ShoppingCart },
  { name: "Purchases", href: "/dashboard/purchases", icon: Truck },
  { name: "Billing", href: "/dashboard/billing", icon: CreditCard },
  { name: "Users & Roles", href: "/dashboard/users", icon: Users },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

  // GLOBAL SYNC ENGINE logic
  const { isSyncing, pendingCount } = useSync();
  const [showDelayedPending, setShowDelayedPending] = useState(false);

  // THE SMART DELAY: Waits 3 seconds before showing the offline badge
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    if (pendingCount > 0) {
      timeout = setTimeout(() => {
        setShowDelayedPending(true);
      }, 3000);
    } else {
      setShowDelayedPending(false);
    }

    return () => clearTimeout(timeout);
  }, [pendingCount]);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (user.must_change_password) {
      if (pathname !== "/change-password") {
        router.replace("/change-password");
      }
    }
  }, [user, isLoading, router, pathname]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F8FAFF]">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-12 w-12 bg-[#EEF2FF] rounded-full mb-4"></div>
          <div className="h-4 w-32 bg-[#EEF2FF] rounded"></div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFF] selection:bg-[#2D31FA] selection:text-white">
      
      {/* --- TOP NAVBAR (Branded Dark Theme) --- */}
      <header className="h-16 bg-[#1A1B4B] text-white flex items-center justify-between px-4 z-30 shrink-0 shadow-md">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
            className="hidden md:flex text-white hover:bg-white/10 hover:text-white"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="md:hidden">
            <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-white">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0 bg-[#1A1B4B] border-white/10 text-white">
                <SheetTitle className="sr-only">Mobile Menu</SheetTitle>
                <SheetDescription className="sr-only">Navigation links</SheetDescription>
                <div className="h-16 flex items-center px-6 border-b border-white/10">
                    <div className="bg-[#2D31FA] p-1.5 rounded-lg mr-2">
                      <PackageSearch size={20} className="text-white" />
                    </div>
                    <span className="text-xl font-black tracking-tighter uppercase">ForeTrack</span>
                </div>
                <div className="py-4 px-3 space-y-1">
                  {NAV_ITEMS.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMobileOpen(false)}
                      className={`flex items-center px-3 py-2 text-sm font-bold uppercase tracking-widest rounded-md transition-colors ${
                        pathname === item.href ? 'bg-[#2D31FA] text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
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

          <div className="flex items-center gap-3">
            <div className="bg-[#2D31FA] p-1.5 rounded-lg shadow-lg shadow-[#2D31FA]/20">
              <PackageSearch size={22} className="text-white" />
            </div>
            <span className="text-xl font-black tracking-tighter text-white uppercase">ForeTrack</span>
          </div>

          {/* SYNC ENGINE STATUS BADGES */}
          <div className="flex gap-2 ml-4">
            {isSyncing && (
                <Badge variant="secondary" className="hidden lg:flex gap-1 bg-white/10 text-white border-none">
                    <Loader2 className="h-3 w-3 animate-spin" />
                </Badge>
            )}
            {showDelayedPending && (
                <Badge variant="destructive" className="hidden lg:flex gap-1 bg-red-500 hover:bg-red-600">
                    <WifiOff className="h-3 w-3" /> {pendingCount}
                </Badge>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-4">
            <div className="text-white scale-110 flex items-center justify-center opacity-100">
              <NotificationsBell />
            </div>
            <div className="[&_span]:text-[#1A1B4B] [&_div]:bg-white [&_div]:border-2 [&_div]:border-white [&_div]:shadow-sm">
              <UserNav />
            </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* --- DESKTOP SIDEBAR --- */}
        <aside 
          className={`hidden md:flex flex-col bg-white border-r border-slate-200 transition-all duration-300 ease-in-out shrink-0 ${
            isSidebarExpanded ? 'w-64' : 'w-20'
          }`}
        >
          <div className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={!isSidebarExpanded ? item.name : ''}
                  className={`flex items-center px-3 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${
                    isActive 
                      ? 'bg-[#EEF2FF] text-[#2D31FA]' 
                      : 'text-[#1A1B4B] hover:bg-slate-50 hover:text-[#2D31FA]'
                  } ${!isSidebarExpanded ? 'justify-center' : ''}`}
                >
                  <item.icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-[#2D31FA]' : 'text-[#1A1B4B]'} ${isSidebarExpanded ? 'mr-3' : 'mr-0'}`} />
                  {isSidebarExpanded && <span className="truncate">{item.name}</span>}
                </Link>
              );
            })}
          </div>

          <div className="p-4 border-t border-slate-100 bg-slate-50/50">
            <div className={`flex items-center gap-3 ${!isSidebarExpanded ? 'justify-center' : ''}`}>
               <Avatar className="h-9 w-9 border-2 border-white shadow-sm shrink-0">
                  <AvatarImage src={`https://ui-avatars.com/api/?name=${user.username}&background=1A1B4B&color=fff`} />
                  <AvatarFallback className="bg-[#1A1B4B] text-white">
                    {getDisplayUsername(user.username).substring(0,2).toUpperCase()}
                  </AvatarFallback>
               </Avatar>
               {isSidebarExpanded && (
                 <div className="flex-1 overflow-hidden text-[#1A1B4B]">
                    <p className="text-xs font-black truncate uppercase tracking-tight">
                      {user.first_name || getDisplayUsername(user.username)}
                    </p>
                    <p className="text-[10px] text-slate-500 font-bold truncate uppercase tracking-widest">
                      {user.is_superuser ? 'Admin' : user.role || 'User'}
                    </p>
                 </div>
               )}
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-auto p-4 md:p-8 bg-[#F8FAFF]">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
        </main>
      </div>
    </div>
  );
}