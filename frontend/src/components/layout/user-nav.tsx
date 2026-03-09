'use client';

import { useTheme } from "next-themes";
import { useState, useEffect } from "react"; // ✅ Added React hooks for mounting
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useRouter } from "next/navigation";
import { 
    LogOut, 
    Settings, 
    User, 
    Moon, 
    Sun, 
    Monitor, 
    ShieldAlert,
    HelpCircle,
    MessageSquare 
} from "lucide-react";
import { useAuth } from "@/lib/auth-context"; 
import SupportDialog from "@/components/support/SupportDialog"; 

export function UserNav() {
  const router = useRouter();
  const { setTheme, theme } = useTheme();
  
  // ✅ ADDED: Mounted state to prevent Next.js hydration mismatch freeze
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  
  const { user, logout } = useAuth(); 

  const initials = (user?.first_name && user?.last_name)
    ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
    : user?.email?.substring(0, 2).toUpperCase() || "U";
      
  const displayName = (user?.first_name && user?.last_name)
    ? `${user.first_name} ${user.last_name}`
    : user?.username || 'User';

  const isPrivileged = user?.role === 'tenant_admin' || user?.role === 'manager';
  const isTenantAdmin = user?.role === 'tenant_admin'; // ✅ Specific check for Tenant Admin

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-9 w-9 rounded-full">
          <Avatar className="h-9 w-9 border">
            <AvatarImage src="" alt={user?.email} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user?.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => router.push('/dashboard/profile')}>
            <User className="mr-2 h-4 w-4" />
            <span>Profile</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push('/dashboard/settings')}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </DropdownMenuItem>
          
          {isPrivileged && (
            <DropdownMenuItem onClick={() => router.push('/dashboard/audit-logs')}>
                <ShieldAlert className="mr-2 h-4 w-4 text-amber-600" />
                <span>Audit Logs</span>
            </DropdownMenuItem>
          )}

          {/* Link to View Support History (Tenant Admin Only) */}
          {isTenantAdmin && (
             <DropdownMenuItem onClick={() => router.push('/dashboard/support')}>
                <MessageSquare className="mr-2 h-4 w-4 text-blue-500" />
                <span>My Tickets</span>
             </DropdownMenuItem>
          )}

          {/* GET HELP MODAL */}
          <SupportDialog>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
               <HelpCircle className="mr-2 h-4 w-4 text-green-600" />
               <span>Get Help</span>
            </DropdownMenuItem>
          </SupportDialog>

        </DropdownMenuGroup>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuLabel className="text-xs text-muted-foreground">Theme</DropdownMenuLabel>
        {/* ✅ UPDATED: Added the `mounted &&` check to the checkmarks */}
        <DropdownMenuItem onClick={() => setTheme("light")}>
           <Sun className="mr-2 h-4 w-4" /> Light
           {mounted && theme === 'light' && <span className="ml-auto text-xs">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
           <Moon className="mr-2 h-4 w-4" /> Dark
           {mounted && theme === 'dark' && <span className="ml-auto text-xs">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
           <Monitor className="mr-2 h-4 w-4" /> System
           {mounted && theme === 'system' && <span className="ml-auto text-xs">✓</span>}
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={logout} className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20 cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}