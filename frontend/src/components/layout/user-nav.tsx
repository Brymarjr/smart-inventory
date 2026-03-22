'use client';

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
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

// UI Components
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

// Contexts & Custom Components
import { useAuth } from "@/lib/auth-context";
import SupportDialog from "@/components/support/SupportDialog";

export function UserNav() {
  const router = useRouter();
  const { setTheme, theme } = useTheme();
  const { user, logout } = useAuth();
  
  // Prevent hydration mismatch for theme-specific UI
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Logout successful", {
        id: "logout-toast",
      });
      router.push("/login");
    } catch (error) {
      toast.error("Failed to log out");
    }
  };

  // ✅ Fixed: Joined first_name and last_name manually for the UI
  // ✅ Fixed: Added explicit type (n: string) to resolve the implicit 'any' error
  const initials = (user?.first_name && user?.last_name)
    ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
    : user?.email?.substring(0, 2).toUpperCase() || "U";
      
  const displayName = (user?.first_name && user?.last_name)
    ? `${user.first_name} ${user.last_name}`
    : user?.username || user?.email || 'User';

  const isPrivileged = user?.role === 'tenant_admin' || user?.role === 'manager';
  const isTenantAdmin = user?.role === 'tenant_admin';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-9 w-9 rounded-full">
          <Avatar className="h-9 w-9 border">
            {/* ✅ Removed .image to satisfy TypeScript User type */}
            <AvatarImage src="" alt={displayName} />
            <AvatarFallback className="bg-primary/10 text-primary font-bold">
              {initials}
            </AvatarFallback>
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

          {isTenantAdmin && (
             <DropdownMenuItem onClick={() => router.push('/dashboard/support')}>
                <MessageSquare className="mr-2 h-4 w-4 text-blue-500" />
                <span>My Tickets</span>
             </DropdownMenuItem>
          )}

          <SupportDialog>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
               <HelpCircle className="mr-2 h-4 w-4 text-green-600" />
               <span>Get Help</span>
            </DropdownMenuItem>
          </SupportDialog>
        </DropdownMenuGroup>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuLabel className="text-xs text-muted-foreground">Theme</DropdownMenuLabel>
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
        
        <DropdownMenuItem 
          onClick={handleLogout} 
          className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20 cursor-pointer"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}