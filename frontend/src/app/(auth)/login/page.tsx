'use client';

import { useState, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link'; 
import { useSearchParams } from 'next/navigation'; // ✅ Import SearchParams
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
import { AlertCircle, Building2, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';

const tenantSchema = z.object({
  tenant: z.string().min(1, 'Organization ID is required'),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

// ✅ Separate component to safely use searchParams
function LoginForm() {
  const { loginTenant } = useAuth();
  const searchParams = useSearchParams();
  
  // ✅ AUTO-FILL: Check URL for ?tenant=xxx&username=yyy
  const defaultTenant = searchParams.get('tenant') || '';
  const defaultUser = searchParams.get('username') || '';

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const tenantForm = useForm<z.infer<typeof tenantSchema>>({
    resolver: zodResolver(tenantSchema),
    defaultValues: { 
        tenant: defaultTenant, 
        username: defaultUser, 
        password: '' 
    },
  });

  async function onTenantSubmit(values: z.infer<typeof tenantSchema>) {
    setIsLoading(true);
    setError('');
    try {
      await loginTenant(values.tenant, values.username, values.password);
      toast.success('Welcome back!');
    } catch (err: any) {
      console.error(err);
      const serverMsg = err.response?.data?.detail || err.response?.data?.tenant || 'Invalid Organization ID or credentials.';
      setError(Array.isArray(serverMsg) ? serverMsg[0] : serverMsg);
      toast.error("Login Failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md shadow-xl border-slate-200">
        <CardHeader className="text-center pb-6">
          <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-4">
            <Building2 className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold text-slate-900">
            Organization Login
          </CardTitle>
          <CardDescription>
            Access your company inventory workspace.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Form {...tenantForm}>
            <form onSubmit={tenantForm.handleSubmit(onTenantSubmit)} className="space-y-4">
              <FormField
                control={tenantForm.control}
                name="tenant"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization ID</FormLabel>
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
                    <div className="flex items-center justify-between">
                        <FormLabel>Password</FormLabel>
                        <Link 
                            href="/forgot-password" 
                            className="text-sm font-medium text-primary hover:underline"
                            tabIndex={-1}
                        >
                            Forgot password?
                        </Link>
                    </div>
                    <FormControl>
                      <Input type="password" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Authenticating...</> : 'Sign In'}
              </Button>
            </form>
          </Form>
        </CardContent>
        
        <CardFooter className="flex justify-center border-t pt-4">
            <p className="text-sm text-slate-500">
              Don't have an account? <Link href="/register" className="text-primary font-medium hover:underline">Register your business</Link>
            </p>
        </CardFooter>
      </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      {/* ✅ Suspense is required when using useSearchParams in Next.js App Router */}
      <Suspense fallback={<div className="flex items-center gap-2"><Loader2 className="animate-spin" /> Loading...</div>}>
         <LoginForm />
      </Suspense>
    </div>
  );
}