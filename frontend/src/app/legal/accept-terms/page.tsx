'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { PackageSearch, Loader2 } from 'lucide-react';
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
      <Card className="w-full max-w-3xl shadow-xl border-t-4 border-t-blue-600">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <PackageSearch className="h-8 w-8 text-blue-600" />
            <span className="font-black text-xl tracking-tight uppercase">FORETRACK</span>
          </div>
          <CardTitle className="text-2xl">Terms of Service Agreement</CardTitle>
          <CardDescription>
            Access to the FORETRACK platform is subject to the following terms.
            <br />
            <span className="text-xs text-muted-foreground font-medium">Version 1.0.0 — Effective March 2026</span>
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <ScrollArea className="h-[400px] w-full rounded-md border p-6 bg-white text-sm leading-relaxed text-gray-700 shadow-inner dark:bg-gray-800 dark:text-gray-300">
            <div className="space-y-6">
              <section>
                <h3 className="font-bold mb-2 text-gray-900 dark:text-white text-base">1. Acceptance of Terms</h3>
                <p>
                  By accessing, logging into, or utilizing the FORETRACK platform, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions. If you do not agree with any part of these terms, you must discontinue use of the platform immediately.
                </p>
              </section>

              <section>
                <h3 className="font-bold mb-2 text-gray-900 dark:text-white text-base">2. User Responsibilities</h3>
                <p>
                  Users are strictly responsible for maintaining the accuracy of the data entered into the system. You agree to utilize FORETRACK in a lawful, ethical manner and refrain from using the platform for any unauthorized or illegal operations that violate local or international laws.
                </p>
              </section>

              <section>
                <h3 className="font-bold mb-2 text-gray-900 dark:text-white text-base">3. Account Security</h3>
                <p>
                  Access is granted strictly to authorized personnel. You are solely responsible for safeguarding your authentication credentials. Sharing accounts, passwords, or attempting to bypass platform security controls is strictly prohibited and will result in immediate termination of access.
                </p>
              </section>

              <section>
                <h3 className="font-bold mb-2 text-gray-900 dark:text-white text-base">4. Acceptable Use Policy</h3>
                <p>
                  FORETRACK is a proprietary enterprise software. Users shall not reproduce, distribute, modify, create derivative works of, publicly display, or reverse-engineer any underlying code, algorithms, or infrastructure belonging to the platform.
                </p>
              </section>

              <section>
                <h3 className="font-bold mb-2 text-gray-900 dark:text-white text-base">5. Data Usage and Privacy</h3>
                <p>
                  Your organization retains full ownership of all inventory, logistical, and operational data uploaded to FORETRACK. The platform processes this data exclusively to provide optimized inventory management tools specifically scaled for small to medium-sized enterprise operations. We employ industry-standard encryption to protect your records.
                </p>
              </section>

              <section>
                <h3 className="font-bold mb-2 text-gray-900 dark:text-white text-base">6. Limitation of Liability</h3>
                <p>
                  FORETRACK is provided on an "as is" and "as available" basis. The licensor shall not be held liable for any indirect, incidental, or consequential damages, including but not limited to inventory discrepancies, financial losses, or business interruptions resulting from user error, hardware failure, or network latency.
                </p>
              </section>

              <section>
                <h3 className="font-bold mb-2 text-gray-900 dark:text-white text-base">7. Intellectual Property Rights</h3>
                <p>
                  All software, design, text, graphics, and other content within the platform are the exclusive intellectual property of FORETRACK. Continued use of the service grants you a limited, non-exclusive license to use the software for its intended operational purposes.
                </p>
              </section>

              <section>
                <h3 className="font-bold mb-2 text-gray-900 dark:text-white text-base">8. Service Availability</h3>
                <p>
                  While we strive for high operational availability to support your business, FORETRACK does not guarantee 100% continuous, uninterrupted uptime. Scheduled maintenance and updates will be communicated in advance whenever possible.
                </p>
              </section>

              <section>
                <h3 className="font-bold mb-2 text-gray-900 dark:text-white text-base">9. Modifications to Terms</h3>
                <p>
                  FORETRACK reserves the right to modify or replace these Terms at any time. Significant changes will be communicated via the platform dashboard. Continued use of the application following any modifications constitutes formal acceptance of the updated terms.
                </p>
              </section>

              <section>
                <h3 className="font-bold mb-2 text-gray-900 dark:text-white text-base">10. Contact Information</h3>
                <p>
                  For any questions, legal inquiries, or compliance concerns regarding these Terms of Service, please contact your designated FORETRACK technical support representative or system administrator.
                </p>
              </section>
            </div>
          </ScrollArea>
        </CardContent>

        <CardFooter className="flex flex-col gap-5 border-t pt-6 bg-gray-50/80 dark:bg-gray-900/80 rounded-b-xl">
          <div className="flex items-start space-x-3 w-full p-2">
            <Checkbox 
              id="terms" 
              checked={agreed} 
              onCheckedChange={(checked) => setAgreed(checked === true)}
              className="mt-1 h-5 w-5 border-2 border-slate-400 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 data-[state=checked]:text-white [&_svg]:text-white [&_svg]:stroke-white" 
            />
            <label
              htmlFor="terms"
              className="text-sm font-semibold leading-snug cursor-pointer text-slate-700 dark:text-slate-300"
            >
              I have read and agree to the FORETRACK Terms and Conditions.
            </label>
          </div>

          <Button 
            className="w-full h-14 text-base font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all" 
            size="lg" 
            disabled={!agreed || isSubmitting}
            onClick={handleAccept}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Processing Acceptance...
              </>
            ) : (
              "Accept & Continue to Dashboard"
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}