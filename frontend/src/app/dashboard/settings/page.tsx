'use client';

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Store, Shield, Bell, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth-context"; // ✅ Import Auth
import { toast } from "sonner";
import api from "@/lib/api";

export default function SettingsPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  // Define who is an admin (Adjust 'TENANT_ADMIN' to match your exact DB role string)
  const isAdmin = user?.role === 'tenant_admin' || user?.is_superuser;

  // --- HANDLERS ---
  
  // 1. Handle Password Change
  const handlePasswordChange = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    const formData = new FormData(e.currentTarget);
    const current_password = formData.get("current_password");
    const new_password = formData.get("new_password");

    try {
        await api.post('/api/users/password/change_password/', {
            current_password,
            new_password,
        });
        toast.success("Password updated successfully!");
        (e.target as HTMLFormElement).reset(); // Clear the form
    } catch (error: any) {
        toast.error(error.response?.data?.message || "Failed to update password.");
    } finally {
        setIsLoading(false);
    }
  };

  // 2. Handle Store Settings (Placeholder for now)
  const handleStoreSave = () => {
      toast.info("Store settings endpoint not ready yet.");
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-3xl font-bold tracking-tight">Settings</h3>
        <p className="text-muted-foreground">
          Manage your store preferences and security.
        </p>
      </div>
      
      <Tabs defaultValue={isAdmin ? "store" : "notifications"} className="space-y-4">
        <TabsList>
          {/* ✅ ONLY SHOW STORE TAB IF ADMIN */}
          {isAdmin && (
            <TabsTrigger value="store" className="flex items-center gap-2">
                <Store className="h-4 w-4" /> Store
            </TabsTrigger>
          )}
          
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" /> Notifications
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
             <Shield className="h-4 w-4" /> Security
          </TabsTrigger>
        </TabsList>
        
        {/* 1. STORE SETTINGS (Protected) */}
        {isAdmin && (
            <TabsContent value="store">
                <Card>
                    <CardHeader>
                        <CardTitle>Store Configuration</CardTitle>
                        <CardDescription>Details used for receipts and invoices.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <Label>Store Name</Label>
                            <Input placeholder="My Awesome Store" />
                        </div>
                        <div className="grid gap-2">
                            <Label>Address</Label>
                            <Input placeholder="123 Lagos Street..." />
                        </div>
                        <div className="grid gap-2">
                            <Label>Currency Symbol</Label>
                            <Input placeholder="₦" className="w-20" />
                        </div>
                        <Button onClick={handleStoreSave}>Save Store Settings</Button>
                    </CardContent>
                </Card>
            </TabsContent>
        )}

        {/* 2. NOTIFICATIONS */}
        <TabsContent value="notifications">
            <Card>
                <CardHeader>
                    <CardTitle>Alerts & Emails</CardTitle>
                    <CardDescription>Control what you get notified about.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label className="text-base">Low Stock Alerts</Label>
                            <p className="text-sm text-muted-foreground">Get notified when items reach reorder level.</p>
                        </div>
                        <Switch />
                    </div>
                </CardContent>
            </Card>
        </TabsContent>

        {/* 3. SECURITY (Now Functional) */}
        <TabsContent value="security">
            <Card>
                <CardHeader>
                    <CardTitle>Change Password</CardTitle>
                    <CardDescription>Ensure your account stays safe.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handlePasswordChange} className="space-y-4">
                        <div className="grid gap-2">
                            <Label htmlFor="current_password">Current Password</Label>
                            <Input id="current_password" name="current_password" type="password" required />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="new_password">New Password</Label>
                            <Input id="new_password" name="new_password" type="password" required />
                        </div>
                        <Button variant="destructive" type="submit" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Update Password
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}