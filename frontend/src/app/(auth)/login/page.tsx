'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Building2, ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

// 1. Validation Schema for Tenant Users
const tenantSchema = z.object({
  tenant: z.string().min(1, 'Organization ID is required'),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

// 2. Validation Schema for System Admins
const adminSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export default function LoginPage() {
  const { loginTenant, loginAdmin } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Toggle between 'tenant' (default) and 'admin'
  const [mode, setMode] = useState<'tenant' | 'admin'>('tenant');

  // Initialize Forms
  const tenantForm = useForm<z.infer<typeof tenantSchema>>({
    resolver: zodResolver(tenantSchema),
    defaultValues: { tenant: '', username: '', password: '' },
  });

  const adminForm = useForm<z.infer<typeof adminSchema>>({
    resolver: zodResolver(adminSchema),
    defaultValues: { username: '', password: '' },
  });

  // Handler: Tenant Login
  async function onTenantSubmit(values: z.infer<typeof tenantSchema>) {
    setIsLoading(true);
    setError('');
    try {
      await loginTenant(values.tenant, values.username, values.password);
    } catch (err: any) {
      console.error(err);
      // Try to extract the specific error message from DRF response
      const serverMsg = err.response?.data?.detail || err.response?.data?.tenant || 'Invalid Organization ID or credentials.';
      setError(Array.isArray(serverMsg) ? serverMsg[0] : serverMsg);
    } finally {
      setIsLoading(false);
    }
  }

  // Handler: Admin Login
  async function onAdminSubmit(values: z.infer<typeof adminSchema>) {
    setIsLoading(true);
    setError('');
    try {
      await loginAdmin(values.username, values.password);
    } catch (err: any) {
      console.error(err);
      setError('Invalid System Admin credentials.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md shadow-xl border-slate-200">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-2">
            {mode === 'tenant' ? (
              <Building2 className="w-8 h-8 text-primary" />
            ) : (
              <ShieldCheck className="w-8 h-8 text-red-600" />
            )}
          </div>
          <CardTitle className="text-2xl font-bold text-slate-900">
            {mode === 'tenant' ? 'Organization Login' : 'System Admin'}
          </CardTitle>
          <CardDescription>
            {mode === 'tenant' 
              ? 'Access your company inventory workspace.' 
              : 'Restricted access for system maintainers.'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="tenant" className="w-full" onValueChange={(v) => {
             setMode(v as 'tenant' | 'admin');
             setError(''); // Clear errors when switching tabs
          }}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="tenant">Tenant User</TabsTrigger>
              <TabsTrigger value="admin">System Admin</TabsTrigger>
            </TabsList>

            {/* Error Alert */}
            {error && (
              <Alert variant="destructive" className="mb-4 animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* --- TAB 1: TENANT FORM --- */}
            <TabsContent value="tenant">
              <Form {...tenantForm}>
                <form onSubmit={tenantForm.handleSubmit(onTenantSubmit)} className="space-y-4">
                  <FormField
                    control={tenantForm.control}
                    name="tenant"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Organization ID (Tenant)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. acme-corp" {...field} disabled={isLoading} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={tenantForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input placeholder="john.doe" {...field} disabled={isLoading} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={tenantForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} disabled={isLoading} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'Authenticating...' : 'Sign In'}
                  </Button>
                </form>
              </Form>
            </TabsContent>

            {/* --- TAB 2: ADMIN FORM --- */}
            <TabsContent value="admin">
              <Form {...adminForm}>
                <form onSubmit={adminForm.handleSubmit(onAdminSubmit)} className="space-y-4">
                  <FormField
                    control={adminForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>System Username</FormLabel>
                        <FormControl>
                          <Input placeholder="admin" {...field} disabled={isLoading} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={adminForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} disabled={isLoading} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" variant="destructive" className="w-full" disabled={isLoading}>
                    {isLoading ? 'Verifying...' : 'Access System Core'}
                  </Button>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </CardContent>
        
        {mode === 'tenant' && (
          <CardFooter className="flex justify-center border-t pt-4">
            <p className="text-sm text-slate-500">
              Don't have an account? <a href="/register" className="text-primary font-medium hover:underline">Register your business</a>
            </p>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}