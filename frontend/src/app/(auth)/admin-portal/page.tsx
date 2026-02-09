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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Validation Schema for System Admins
const adminSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export default function AdminLoginPage() {
  const { loginAdmin } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const adminForm = useForm<z.infer<typeof adminSchema>>({
    resolver: zodResolver(adminSchema),
    defaultValues: { username: '', password: '' },
  });

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
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
      <Card className="w-full max-w-md shadow-2xl border-red-900 bg-slate-950 text-slate-100">
        <CardHeader className="text-center pb-6">
          <div className="mx-auto bg-red-900/20 p-4 rounded-full w-fit mb-4 ring-1 ring-red-900/50">
            <ShieldCheck className="w-10 h-10 text-red-500" />
          </div>
          <CardTitle className="text-2xl font-bold text-white tracking-wide">
            System Core Access
          </CardTitle>
          <CardDescription className="text-slate-400">
            Restricted area. Authorized personnel only.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-6 bg-red-900/20 border-red-900 text-red-200">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Form {...adminForm}>
            <form onSubmit={adminForm.handleSubmit(onAdminSubmit)} className="space-y-5">
              <FormField
                control={adminForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-300">System Username</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="root" 
                        {...field} 
                        disabled={isLoading} 
                        className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-600 focus-visible:ring-red-500"
                      />
                    </FormControl>
                    <FormMessage className="text-red-400" />
                  </FormItem>
                )}
              />
              <FormField
                control={adminForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-300">Password</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        {...field} 
                        disabled={isLoading} 
                        className="bg-slate-900 border-slate-700 text-white focus-visible:ring-red-500"
                      />
                    </FormControl>
                    <FormMessage className="text-red-400" />
                  </FormItem>
                )}
              />
              
              <Button 
                type="submit" 
                className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-6 mt-2 shadow-[0_0_15px_rgba(220,38,38,0.3)] hover:shadow-[0_0_25px_rgba(220,38,38,0.5)] transition-all" 
                disabled={isLoading}
              >
                {isLoading ? 'Verifying Clearance...' : 'Authenticate'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}