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
  FormDescription,
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
    },
  });

  async function onSubmit(values: RegisterValues) {
    setIsLoading(true);
    try {
      await api.post('/api/tenants/register/', {
        tenant_name: values.tenant_name,
        username: values.username,
        email: values.email,
        password: values.password,
        first_name: values.first_name,
        last_name: values.last_name,
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
      console.error(error);
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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-lg shadow-xl border-slate-200">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-2">
            <Rocket className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold text-slate-900">
            Start your Free Trial
          </CardTitle>
          <CardDescription>
            Create your organization workspace.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              
              {/* COMPANY SECTION */}
              <div className="space-y-4 border-b pb-4">
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Organization Details</h3>
                <FormField
                  control={form.control}
                  name="tenant_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company / Tenant Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Acme Corp" {...field} disabled={isLoading} />
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
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl><Input type="password" {...field} disabled={isLoading} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button type="submit" className="w-full mt-6" size="lg" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating Workspace...
                  </>
                ) : (
                  'Create Account'
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
        
        <CardFooter className="flex justify-center border-t pt-4">
          <p className="text-sm text-slate-500">
            Already have an account? <Link href="/login" className="text-primary font-medium hover:underline">Log in</Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}