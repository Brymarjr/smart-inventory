'use client';

import { useState, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link'; 
import { useSearchParams, useRouter } from 'next/navigation';
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
import { AlertCircle, Building2, Loader2, Eye, EyeOff, PackageSearch, ArrowLeft } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';

// Schema from Code A
const tenantSchema = z.object({
  tenant: z.string().min(1, 'Organization ID is required'),
  email: z.string().email('Invalid email address').min(1, 'Email is required'),
  password: z.string().min(1, 'Password is required'),
});

function LoginForm() {
  // Logic from Code A
  const { loginTenant } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const defaultTenant = searchParams.get('tenant') || '';
  const defaultEmail = searchParams.get('email') || searchParams.get('username') || '';

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // UI State from Code B
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<z.infer<typeof tenantSchema>>({
    resolver: zodResolver(tenantSchema),
    defaultValues: { 
        tenant: defaultTenant, 
        email: defaultEmail, 
        password: '' 
    },
  });

  // Submission logic strictly from Code A
  async function onSubmit(values: z.infer<typeof tenantSchema>) {
    setIsLoading(true);
    setError('');
    try {
      await loginTenant(values.tenant, values.email, values.password);
      toast.success('Welcome back!');
      router.refresh();
    } catch (err: any) {
      console.error(err);
      const serverMsg = err.response?.data?.detail || err.response?.data?.non_field_errors || 'Invalid Organization ID or credentials.';
      setError(Array.isArray(serverMsg) ? serverMsg[0] : serverMsg);
      toast.error("Login Failed");
    } finally {
      setIsLoading(false);
    }
  }

  // Tailwind trick from Code B
  const disableBrowserEye = "[&::-ms-reveal]:hidden [&::-ms-clear]:hidden [&::-webkit-contacts-auto-fill-button]:hidden";

  return (
    <div className="h-screen w-full flex flex-col lg:flex-row bg-white overflow-hidden">
      
      {/* LEFT PANEL - Professional Branding (From Code B) */}
      <div className="hidden lg:flex w-full lg:w-5/12 bg-[#1A1B4B] text-white p-12 flex-col justify-between relative">
        <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-[#2D31FA] opacity-10 rounded-full blur-3xl"></div>
        
        <div className="relative z-10 space-y-10">
          <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group mb-10 w-fit">
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-black uppercase tracking-widest">Back to Home</span>
          </Link>

          <div className="flex items-center gap-4">
            <div className="bg-[#2D31FA] p-2 rounded-lg">
              <PackageSearch className="w-8 h-8 text-white" />
            </div>
            <span className="text-3xl font-bold tracking-tight">ForeTrack</span>
          </div>
          
          <div className="space-y-6">
            <h1 className="text-6xl font-black leading-tight">
              Precision Stock <br />
              <span className="text-[#2D31FA]">Management.</span>
            </h1>
            <div className="space-y-4 max-w-md">
              <p className="text-slate-400 text-xl leading-relaxed max-w-sm font-light">
                ForeTrack transforms complex inventory data into simple, actionable insights. 
                Built specifically for the logistical challenges of modern Nigerian enterprises.
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10 border-t border-white/10 pt-6">
          <div className="flex items-center gap-6 text-xs font-semibold tracking-widest uppercase text-slate-500">
            <span>Optimized</span>
            <span className="w-1 h-1 bg-[#2D31FA] rounded-full"></span>
            <span>Automated</span>
            <span className="w-1 h-1 bg-[#2D31FA] rounded-full"></span>
            <span>Scalable</span>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL - Login Form (Merged A Logic + B UI) */}
      <div className="flex-1 flex items-center justify-center bg-slate-50 p-4 overflow-y-auto w-full">
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
              <form onSubmit={form.handleSubmit(onSubmit)} method="POST" className="space-y-6">
                
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
                      <div className="relative">
                        <FormControl>
                          <Input 
                            type={showPassword ? "text" : "password"} 
                            placeholder="••••••••"
                            {...field} 
                            disabled={isLoading} 
                            className={`h-16 text-xl border-2 border-[#1A1B4B] rounded-2xl focus-visible:ring-2 focus-visible:ring-[#2D31FA] focus-visible:ring-offset-0 px-6 pr-14 ${disableBrowserEye}`} 
                          />
                        </FormControl>
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#2D31FA] focus:outline-none"
                        >
                          {showPassword ? <EyeOff className="h-6 w-6" /> : <Eye className="h-6 w-6" />}
                        </button>
                      </div>
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

                <Button 
                  type="submit" 
                  className="w-full h-16 text-xl font-black bg-[#2D31FA] hover:bg-[#1A1B4B] text-white rounded-2xl shadow-2xl shadow-[#2D31FA]/20 transition-all tracking-widest mt-2 flex items-center justify-center gap-3" 
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-6 w-6 animate-spin" /> 
                      VERIFYING...
                    </>
                  ) : (
                    'SIGN IN'
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
          
          <CardFooter className="flex justify-center border-t border-slate-100 mt-2 pt-4">
            <p className="text-base text-slate-500 font-semibold">
              New to ForeTrack?{' '}
              <Link href="/register" className="text-[#2D31FA] font-black hover:text-[#1A1B4B]">
                Register Business
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

// Suspense boundary kept from Code A, styled to match the new full-screen aesthetic
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen w-full items-center justify-center gap-2 font-bold text-[#2D31FA] bg-slate-50">
        <Loader2 className="animate-spin" /> Loading Security...
      </div>
    }>
       <LoginForm />
    </Suspense>
  );
}