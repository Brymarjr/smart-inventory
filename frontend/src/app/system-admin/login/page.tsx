'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ShieldCheck, Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function AdminLoginPage() {
  const router = useRouter();
  
  const { loginAdmin } = useAuth(); 
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // ✅ FIX 2: Call the existing function
      await loginAdmin(username, password); 
      
      // Redirect handled in auth-context, but good to have here as backup
      // router.push('/system-admin'); 
      
    } catch (err: any) {
      console.error(err);
      // Show the specific error message from your context (e.g., "Unauthorized...")
      setError(err.message || 'Invalid Superuser credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
      <Card className="w-full max-w-md border-slate-700 bg-slate-800 text-slate-100 shadow-2xl">
        <CardHeader className="text-center pb-6">
          <div className="mx-auto bg-purple-500/20 p-3 rounded-full w-fit mb-4">
            <ShieldCheck className="w-10 h-10 text-purple-400" />
          </div>
          <CardTitle className="text-2xl font-bold text-white">System Admin</CardTitle>
          <CardDescription className="text-slate-400">
            Restricted access. Authorized personnel only.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4 bg-red-900/50 border-red-800 text-red-200">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-slate-200">Superuser ID</Label>
              <Input 
                id="username"
                className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-600 focus:border-purple-500"
                placeholder="root" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
              />
            </div>
            
            <div className="space-y-2">
              {/* ✅ FIX 3: Fixed 'classname' typo to 'className' */}
              <Label htmlFor="password" className="text-slate-200">Password</Label>
              <Input 
                id="password"
                type="password" 
                className="bg-slate-900 border-slate-700 text-white focus:border-purple-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <Button 
                type="submit" 
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold" 
                disabled={isLoading}
            >
              {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying Access...</> : 'Access Dashboard'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}