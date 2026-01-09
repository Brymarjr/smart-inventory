'use client';

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Store, Shield, Bell, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch"; 
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import api from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";

// Define what our data looks like
interface SettingsData {
  store_name: string;
  store_address: string;
  currency_symbol: string;
  low_stock_alerts: boolean;
  weekly_reports: boolean;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'tenant_admin' || user?.is_superuser;

  // --- 1. FETCH SETTINGS ---
  const { data: settings, isLoading: isFetching } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await api.get('/api/settings/');
      return res.data as SettingsData;
    },
    // Don't refetch too aggressively
    staleTime: 1000 * 60 * 5, 
  });

  // --- 2. FORMS SETUP ---
  const { register, handleSubmit, reset, setValue, watch } = useForm<SettingsData>();

  // Watch toggles specifically so we can see them switch in real-time
  const lowStock = watch("low_stock_alerts");
  const weeklyReports = watch("weekly_reports");

  // Populate form when data arrives
  useEffect(() => {
    if (settings) {
      reset({
        store_name: settings.store_name || "",
        store_address: settings.store_address || "",
        currency_symbol: settings.currency_symbol || "₦",
        low_stock_alerts: settings.low_stock_alerts ?? true,
        weekly_reports: settings.weekly_reports ?? false,
      });
    }
  }, [settings, reset]);

  // --- 3. SAVE MUTATION ---
  const mutation = useMutation({
    mutationFn: async (data: Partial<SettingsData>) => {
      // We use POST because our ViewSet uses 'create' method for updates
      await api.post('/api/settings/', data);
    },
    onSuccess: () => {
      toast.success("Settings saved successfully!");
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: () => toast.error("Failed to save settings.")
  });

  // Handlers
  const onStoreSave = (data: SettingsData) => {
    mutation.mutate({
        store_name: data.store_name,
        store_address: data.store_address,
        currency_symbol: data.currency_symbol
    });
  };

  const onNotificationSave = () => {
    // We grab the current values from the form state
    mutation.mutate({
        low_stock_alerts: lowStock,
        weekly_reports: weeklyReports
    });
  };

  // Password Handler (Kept separate as it hits a different API)
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const handlePasswordChange = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPasswordLoading(true);
    const formData = new FormData(e.currentTarget);
    try {
        await api.post('/api/users/password/change_password/', {
            current_password: formData.get("current_password"),
            new_password: formData.get("new_password"),
        });
        toast.success("Password updated successfully!");
        (e.target as HTMLFormElement).reset(); 
    } catch (error: any) {
        toast.error(error.response?.data?.message || "Failed to update password.");
    } finally {
        setIsPasswordLoading(false);
    }
  };

  if (isFetching) return <div className="p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-3xl font-bold tracking-tight">Settings</h3>
        <p className="text-muted-foreground">Manage your store preferences and security.</p>
      </div>
      
      <Tabs defaultValue={isAdmin ? "store" : "notifications"} className="space-y-4">
        <TabsList>
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
        
        {/* --- STORE TAB --- */}
        {isAdmin && (
            <TabsContent value="store">
                <Card>
                    <CardHeader>
                        <CardTitle>Store Configuration</CardTitle>
                        <CardDescription>Details used for receipts and invoices.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* We use handleSubmit just for this section's button */}
                        <div className="grid gap-2">
                            <Label>Store Name</Label>
                            <Input {...register("store_name")} placeholder="My Awesome Store" />
                        </div>
                        <div className="grid gap-2">
                            <Label>Address</Label>
                            <Input {...register("store_address")} placeholder="123 Lagos Street..." />
                        </div>
                        <div className="grid gap-2">
                            <Label>Currency Symbol</Label>
                            <Input {...register("currency_symbol")} placeholder="₦" className="w-20" />
                        </div>
                        <Button onClick={handleSubmit(onStoreSave)} disabled={mutation.isPending}>
                            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <Save className="mr-2 h-4 w-4" />
                            Save Store Settings
                        </Button>
                    </CardContent>
                </Card>
            </TabsContent>
        )}

        {/* --- NOTIFICATIONS TAB --- */}
        <TabsContent value="notifications">
            <Card>
                <CardHeader>
                    <CardTitle>Alerts & Emails</CardTitle>
                    <CardDescription>Control what you get notified about.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label className="text-base">Low Stock Alerts</Label>
                            <p className="text-sm text-muted-foreground">Get notified when items reach reorder level.</p>
                        </div>
                        {/* Controlled Switch */}
                        <Switch 
                            checked={lowStock}
                            onCheckedChange={(val) => setValue("low_stock_alerts", val)}
                        />
                    </div>
                    
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label className="text-base">Weekly Reports</Label>
                            <p className="text-sm text-muted-foreground">Receive sales summary via email.</p>
                        </div>
                        <Switch 
                             checked={weeklyReports}
                             onCheckedChange={(val) => setValue("weekly_reports", val)}
                        />
                    </div>

                    <Button onClick={onNotificationSave} disabled={mutation.isPending}>
                        {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Preferences
                    </Button>
                </CardContent>
            </Card>
        </TabsContent>

        {/* --- SECURITY TAB --- */}
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
                        <Button variant="destructive" type="submit" disabled={isPasswordLoading}>
                            {isPasswordLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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