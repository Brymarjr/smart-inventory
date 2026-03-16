'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardTitle, CardHeader, CardFooter } from '@/components/ui/card';
import { ArrowLeft, CheckCircle, Loader2, KeyRound, PackageSearch } from 'lucide-react';
import { toast } from 'sonner';

export default function ForgotPasswordPage() {
  // --- PRESERVED LOGIC: EXACTLY AS PROVIDED ---
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const forgotPasswordMutation = useMutation({
    mutationFn: async () => {
      // POST /api/users/password/forgot_password/
      await api.post('/api/users/password/forgot_password/', { email });
    },
    onSuccess: () => {
      // We show success regardless of whether email exists (security practice)
      setIsSubmitted(true);
      toast.success('Request received.');
    },
    onError: (error) => {
      console.error(error);
      toast.error('Failed to process request. Please try again.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    forgotPasswordMutation.mutate();
  };
  // ---------------------------------------------

  return (
    <div className="h-screen w-full flex flex-col lg:flex-row bg-white overflow-hidden">
      
      {/* LEFT PANEL - Professional Branding (Matched to Login Page) */}
      <div className="hidden lg:flex w-full lg:w-5/12 bg-[#1A1B4B] text-white p-12 flex-col justify-between relative">
        <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-[#2D31FA] opacity-10 rounded-full blur-3xl"></div>
        
        <div className="relative z-10 space-y-10">
          <Link href="/login" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group mb-10 w-fit">
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-black uppercase tracking-widest">Back to Login</span>
          </Link>

          <div className="flex items-center gap-4">
            <div className="bg-[#2D31FA] p-2 rounded-lg">
              <PackageSearch className="w-8 h-8 text-white" />
            </div>
            <span className="text-3xl font-bold tracking-tight">ForeTrack</span>
          </div>
          
          <div className="space-y-6">
            <h1 className="text-6xl font-black leading-tight">
              Secure Account <br />
              <span className="text-[#2D31FA]">Recovery.</span>
            </h1>
            <div className="space-y-4 max-w-md">
              <p className="text-slate-400 text-xl leading-relaxed max-w-sm font-light">
                Regain access to your optimized inventory workspace quickly and securely.
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10 border-t border-white/10 pt-6">
          <div className="flex items-center gap-6 text-xs font-semibold tracking-widest uppercase text-slate-500">
            <span>Encrypted</span>
            <span className="w-1 h-1 bg-[#2D31FA] rounded-full"></span>
            <span>Protected</span>
            <span className="w-1 h-1 bg-[#2D31FA] rounded-full"></span>
            <span>Verified</span>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL - Forgot Password Form */}
      <div className="flex-1 flex items-center justify-center bg-slate-50 p-4 overflow-y-auto w-full">
        <Card className="w-full max-w-3xl border-none shadow-[0_20px_60px_rgba(0,0,0,0.12)] rounded-[2.5rem] p-4 lg:p-10 bg-white my-4">
          <CardHeader className="text-center space-y-3 pb-6">
            <div className="mx-auto bg-[#2D31FA]/10 p-4 rounded-3xl w-fit">
              <KeyRound className="w-10 h-10 text-[#2D31FA]" />
            </div>

            <div className="space-y-1">
              <CardTitle className="text-4xl font-black text-[#2D31FA] tracking-tight">
                Reset Password
              </CardTitle>
              <p className="text-slate-400 text-base font-medium">
                Enter your email address to receive reset instructions
              </p>
            </div>
          </CardHeader>
          
          <CardContent className="pb-2">
            {isSubmitted ? (
              // Styled Success State
              <div className="flex flex-col items-center justify-center space-y-6 py-8 text-center bg-slate-50 rounded-3xl border-2 border-slate-100 p-8">
                <div className="bg-green-100 p-4 rounded-full">
                  <CheckCircle className="h-16 w-16 text-green-500" />
                </div>
                <div className="space-y-3 max-w-md">
                  <h3 className="font-black text-2xl text-[#1A1B4B]">Check your email</h3>
                  <p className="text-base text-slate-500 font-medium leading-relaxed">
                    If an account exists for <strong className="text-[#2D31FA]">{email}</strong>, we have sent password reset instructions.
                  </p>
                </div>
                <Button 
                  asChild 
                  className="w-full h-16 text-xl font-black bg-[#2D31FA] hover:bg-[#1A1B4B] text-white rounded-2xl shadow-xl shadow-[#2D31FA]/20 transition-all tracking-widest mt-4"
                >
                  <Link href="/login">RETURN TO LOGIN</Link>
                </Button>
              </div>
            ) : (
              // Styled Form Input (Logic untouched)
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-[#2D31FA] text-lg font-black">
                    Registered Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={forgotPasswordMutation.isPending}
                    className="h-16 text-xl border-2 border-[#1A1B4B] rounded-2xl focus-visible:ring-2 focus-visible:ring-[#2D31FA] focus-visible:ring-offset-0 transition-all px-8 placeholder:text-slate-300"
                  />
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full h-16 text-xl font-black bg-[#2D31FA] hover:bg-[#1A1B4B] text-white rounded-2xl shadow-2xl shadow-[#2D31FA]/20 transition-all tracking-widest mt-2 flex items-center justify-center gap-3" 
                  disabled={forgotPasswordMutation.isPending}
                >
                  {forgotPasswordMutation.isPending ? (
                    <>
                      <Loader2 className="h-6 w-6 animate-spin" /> 
                      SENDING LINK...
                    </>
                  ) : (
                    'SEND RESET LINK'
                  )}
                </Button>
              </form>
            )}
          </CardContent>
          
          {/* Footer Back Link (hidden when submitted) */}
          {!isSubmitted && (
            <CardFooter className="flex justify-center border-t border-slate-100 mt-6 pt-6">
              
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  );
}