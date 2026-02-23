'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api'; 
import { useAuth } from '@/lib/auth-context';

export default function AcceptTermsPage() {
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter(); 
  const { refreshUser } = useAuth(); 

  const handleAccept = async () => {
    if (!agreed) return;
    setIsSubmitting(true);

    try {
      // 1. Send acceptance to backend
      await api.post('/api/users/accept-tos/');
      
      // 2. Refresh the user profile in AuthContext 
      // We MUST await this so the 'user' object is updated before we move
      await refreshUser(); 
      
      toast.success("Terms Accepted. Entering Dashboard...");
      
      // 3. Explicitly redirect to trigger the layout guards
      // Since refreshUser() is finished, the LegalGuard will see tos_accepted_at is now set
      router.push('/dashboard');
      
    } catch (error) {
      console.error(error);
      toast.error("Failed to accept terms. Please try again.");
    } finally {
      setIsSubmitting(false); 
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4 dark:bg-gray-900">
      <Card className="w-full max-w-2xl shadow-xl border-t-4 border-t-blue-600">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="h-8 w-8 text-blue-600" />
            <span className="font-bold text-xl tracking-tight">Smart Inventory</span>
          </div>
          <CardTitle>Terms of Service Agreement</CardTitle>
          <CardDescription>
            Access to this proprietary system is subject to the following terms.
            <br />
            <span className="text-xs text-muted-foreground">Version 1.0.0 — Effective Jan 2026</span>
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <ScrollArea className="h-[400px] w-full rounded-md border p-4 bg-gray-50 text-sm leading-relaxed text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            <h3 className="font-bold mb-2 text-foreground">1. Proprietary System</h3>
            <p className="mb-4">
              Smart Inventory ("The System") is a closed-source, proprietary enterprise platform. 
              Unauthorized reproduction, distribution, or reverse-engineering is strictly prohibited.
            </p>

            <h3 className="font-bold mb-2 text-foreground">2. Authorized Access</h3>
            <p className="mb-4">
              Access is granted strictly to authorized personnel. Sharing credentials or attempting to bypass security controls will result in termination of access.
            </p>

            <h3 className="font-bold mb-2 text-foreground">3. Data Ownership</h3>
            <p className="mb-4">
              Your organization retains full ownership of all inventory and sales data uploaded to the System.
            </p>

            <h3 className="font-bold mb-2 text-foreground">4. Service Availability</h3>
            <p className="mb-4">
              The System utilizes offline-first technology. We do not guarantee 100% uptime for cloud synchronization services.
            </p>

            <h3 className="font-bold mb-2 text-foreground">5. Liability</h3>
            <p className="mb-4">
              The Licensor is not liable for inventory discrepancies resulting from user error or hardware failure.
            </p>
          </ScrollArea>
        </CardContent>

        <CardFooter className="flex flex-col gap-4 border-t pt-6 bg-gray-50/50 dark:bg-gray-900/50">
          <div className="flex items-center space-x-2 w-full">
            <Checkbox 
              id="terms" 
              checked={agreed} 
              onCheckedChange={(checked) => setAgreed(checked === true)} 
            />
            <label
              htmlFor="terms"
              className="text-sm font-medium leading-none cursor-pointer"
            >
              I accept the Terms of Service and adhere to the security protocols.
            </label>
          </div>

          <Button 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white" 
            size="lg" 
            disabled={!agreed || isSubmitting}
            onClick={handleAccept}
          >
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              "Accept & Enter Dashboard"
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}