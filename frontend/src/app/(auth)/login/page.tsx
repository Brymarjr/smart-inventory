'use client';

import { useState, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link'; 
import { useSearchParams } from 'next/navigation';
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
import { Card, CardContent, CardTitle, CardHeader, CardFooter } from '@/components/ui/card';
import { AlertCircle, Building2, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';

const tenantSchema = z.object({
  tenant: z.string().min(1, 'Organization ID is required'),
  email: z.string().email('Invalid email address').min(1, 'Email is required'),
  password: z.string().min(1, 'Password is required'),
});

function LoginForm() {
  const { loginTenant } = useAuth();
  const searchParams = useSearchParams();
  
  const defaultTenant = searchParams.get('tenant') || '';
  const defaultEmail = searchParams.get('email') || '';

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Fixed: Variable named 'form' to match the JSX below
  const form = useForm<z.infer<typeof tenantSchema>>({
    resolver: zodResolver(tenantSchema),
    defaultValues: { 
        tenant: defaultTenant, 
        email: defaultEmail, 
        password: '' 
    },
  });

  async function onSubmit(values: z.infer<typeof tenantSchema>) {
    setIsLoading(true);
    setError('');
    try {
      // Fixed: Passing email instead of username
      await loginTenant(values.tenant, values.email, values.password);
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
    <div className="flex-1 flex items-center justify-center bg-slate-50 p-4 overflow-y-auto">
      <Card className="w-full max-w-3xl border-none shadow-[0_20px_60px_rgba(0,0,0,0.12)] rounded-[2.5rem] p-4 lg:p-10 bg-white my-4">
        <CardHeader className="text-center space-y-3 pb-6">
          <div className="mx-auto bg-[#2D31FA]/10 p-4 rounded-3xl w-fit">
            <Building2 className="w-10 h-10 text-[#2D31FA]" />
          </div>

          <div className="space-y-1">
            <CardTitle className="text-4xl font-black text-[#2D31FA] tracking-tight">
              Organization Login
            </CardTitle>
            <p className="text-slate-400 text-base font-medium">
              Enter your workspace credentials below
            </p>
          </div>
        </CardHeader>

        <CardContent className="pb-2">
          {error && (
            <Alert variant="destructive" className="mb-4 py-2 rounded-2xl border-2">
              <AlertCircle className="h-5 w-5" />
              <AlertDescription className="text-sm font-semibold">{error}</AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              <FormField
                control={form.control}
                name="tenant"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-[#2D31FA] text-lg font-black">Organization ID</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. shoprite-ng"
                        {...field}
                        disabled={isLoading}
                        className="h-16 text-xl border-2 border-[#1A1B4B] rounded-2xl focus-visible:ring-2 focus-visible:ring-[#2D31FA] focus-visible:ring-offset-0 transition-all px-8 placeholder:text-slate-300"
                      />
                    </FormControl>
                    <FormMessage className="text-xs font-bold" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-[#2D31FA] text-lg font-black">Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="john@company.com"
                        {...field}
                        disabled={isLoading}
                        className="h-16 text-xl border-2 border-[#1A1B4B] rounded-2xl focus-visible:ring-2 focus-visible:ring-[#2D31FA] focus-visible:ring-offset-0 transition-all px-8 placeholder:text-slate-300"
                      />
                    </FormControl>
                    <FormMessage className="text-xs font-bold" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-[#2D31FA] text-lg font-black">Password</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        {...field} 
                        disabled={isLoading} 
                        className="h-16 text-xl border-2 border-[#1A1B4B] rounded-2xl focus-visible:ring-2 focus-visible:ring-[#2D31FA] focus-visible:ring-offset-0 px-6" 
                      />
                    </FormControl>
                    <div className="flex justify-end pt-1">
                      <Link 
                        href="/forgot-password" 
                        className="text-xs font-black text-[#2D31FA] hover:text-[#1A1B4B] uppercase tracking-tighter"
                      >
                        Forgot Password?
                      </Link>
                    </div>
                    <FormMessage className="text-xs font-bold" />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full h-16 text-xl rounded-2xl bg-[#2D31FA] hover:bg-[#1A1B4B] font-black transition-all" disabled={isLoading}>
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Authenticating...</> : 'Sign In'}
              </Button>
            </form>
          </Form>
        </CardContent>
        
        <CardFooter className="flex justify-center border-t pt-6 mt-4">
            <p className="text-sm text-slate-500 font-medium">
              Don't have an account? <Link href="/register" className="text-[#2D31FA] font-black hover:underline ml-1">Register your business</Link>
            </p>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Suspense fallback={<div className="flex items-center gap-2 font-bold text-[#2D31FA]"><Loader2 className="animate-spin" /> Loading Security...</div>}>
         <LoginForm />
      </Suspense>
    </div>
  );
}