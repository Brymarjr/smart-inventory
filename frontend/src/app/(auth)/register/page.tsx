'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import api from '@/lib/api';
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
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Rocket } from 'lucide-react';
import { toast } from 'sonner';

const registerSchema = z.object({
  tenant_name: z.string().min(2, 'Company name is required'),
  username: z.string().min(3, 'Admin username is required').regex(/^[a-zA-Z0-9_]+$/, 'Alphanumeric and underscores only'),
  email: z.string().email('Invalid email address'),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
  terms: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the terms and conditions' }),
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type RegisterValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      tenant_name: '',
      username: '',
      email: '',
      first_name: '',
      last_name: '',
      password: '',
      confirmPassword: '',
    },
  });

  async function onSubmit(values: RegisterValues) {
    setIsLoading(true);
    try {
      await api.post('/api/tenants/register/', {
        tenant_name: values.tenant_name,
        username: values.username,
        email: values.email,
        first_name: values.first_name,
        last_name: values.last_name,
        password: values.password,
      });
      
      // ✅ SUCCESS FEEDBACK
      toast.success('Registration Successful!', {
        description: 'Redirecting to login...',
        duration: 2000,
      });

      // ✅ SMART REDIRECT: Send the tenant name to the login page
      setTimeout(() => {
        const tenantSlug = values.tenant_name.toLowerCase().replace(/\s+/g, '-');
        router.push(`/login?tenant=${tenantSlug}&username=${values.username}`);
      }, 1500);
      
    } catch (error: any) {
      const data = error.response?.data;
      
      // Map specific field errors
      if (data?.tenant_name) form.setError('tenant_name', { message: data.tenant_name[0] });
      else if (data?.username) form.setError('username', { message: data.username[0] });
      else if (data?.email) form.setError('email', { message: data.email[0] });
      else {
        toast.error('Registration failed', {
            description: 'Please check your inputs and try again.'
        });
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="h-screen flex flex-col lg:flex-row bg-white overflow-hidden">
      {/* LEFT PANEL */}
      <div className="hidden lg:flex w-full lg:w-5/12 bg-[#1A1B4B] text-white p-12 flex-col justify-between relative">
        <div className="absolute top-[-5%] right-[-5%] w-64 h-64 bg-[#2D31FA] opacity-10 rounded-full blur-3xl"></div>

        <div className="relative z-10 space-y-10">
          {/* Back to Home Link */}
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
          
          <div className="space-y-4">
            <h1 className="text-6xl font-black leading-tight">
              Scale Your <br />
              <span className="text-[#2D31FA]">Business.</span>
            </h1>
            <p className="text-slate-200 text-xl font-medium leading-relaxed">
              Stop guessing. Start growing. 
            </p>
            <p className="text-slate-400 text-xl leading-relaxed max-w-sm font-light">
              Join Nigerian SMEs optimizing their operations with AI-driven inventory insights.
            </p>
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

      {/* RIGHT PANEL */}
      <div className="flex-1 flex items-center justify-center bg-slate-50 p-4 overflow-y-auto">
        <Card className="w-full max-w-3xl border-none shadow-[0_20px_60px_rgba(0,0,0,0.12)] rounded-[2.5rem] p-4 lg:p-10 bg-white my-4">
          <CardHeader className="text-center space-y-3 pb-6">
            <div className="mx-auto bg-[#2D31FA]/10 p-4 rounded-3xl w-fit">
              <Rocket className="w-10 h-10 text-[#2D31FA]" />
            </div>
            <CardTitle className="text-4xl font-black text-[#2D31FA]">Register Organisation</CardTitle>
            <p className="text-slate-400 text-lg font-medium">Set up your administrative dashboard</p>
          </CardHeader>

          <CardContent className="pb-2">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-4">
                  
                  <FormField control={form.control} name="tenant_name" render={({ field }) => (
                    <FormItem className="lg:col-span-2 space-y-1">
                      <FormLabel className="text-[#2D31FA] text-lg font-black">Organization Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Acme Retail" {...field} disabled={isLoading} className="h-16 text-xl border-2 border-[#1A1B4B] rounded-2xl focus-visible:ring-2 focus-visible:ring-[#2D31FA] focus-visible:ring-offset-0 px-6" />
                      </FormControl>
                      <FormMessage className="text-xs font-bold" />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="first_name" render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-[#2D31FA] text-lg font-black">First Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John" {...field} disabled={isLoading} className="h-16 text-xl border-2 border-[#1A1B4B] rounded-2xl focus-visible:ring-2 focus-visible:ring-[#2D31FA] focus-visible:ring-offset-0 px-6" />
                      </FormControl>
                      <FormDescription className="text-xs">
                        This will be your Organization ID.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* ADMIN USER SECTION */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider pt-2">Admin Account</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="first_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl><Input placeholder="John" {...field} disabled={isLoading} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="last_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl><Input placeholder="Doe" {...field} disabled={isLoading} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Admin Username</FormLabel>
                        <FormControl><Input placeholder="johndoe" {...field} disabled={isLoading} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                />
                
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Work Email</FormLabel>
                      <FormControl><Input type="email" placeholder="john@acme.com" {...field} disabled={isLoading} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                {/* Terms and Conditions Checkbox */}
                <FormField
                  control={form.control}
                  name="terms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl><Input type="password" {...field} disabled={isLoading} /></FormControl>
                      <FormMessage />
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
                      INITIALIZING...
                    </>
                  ) : (
                    'CREATE ACCOUNT'
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>

          <CardFooter className="flex justify-center border-t border-slate-50 mt-2 pt-4">
            <p className="text-base text-slate-500 font-semibold">
              Already have an account? <Link href="/login" className="text-[#2D31FA] font-black hover:text-[#1A1B4B]">Log in</Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}