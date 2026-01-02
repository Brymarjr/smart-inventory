'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Plan, Subscription, PaginatedResponse } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Loader2, AlertTriangle, CreditCard, XCircle, RefreshCw, History, UserCog, CalendarPlus, ShieldAlert, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function BillingPage() {
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  // =========================================================
  //  GATEKEEPER: RBAC PROTECTION
  // =========================================================
  
  // 1. Define who is allowed to see this page
  const ALLOWED_ROLES = ['tenant_admin'];
  
  // 2. Check if user has permission (skip check if still loading or superuser)
  const isAllowed = 
    authLoading || 
    (user as any)?.is_superuser || 
    (user?.role && ALLOWED_ROLES.includes(user.role));

  // 3. If NOT allowed, return the "Access Denied" screen immediately
  if (!authLoading && !isAllowed) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center text-center p-6">
        <div className="rounded-full bg-red-100 p-3 mb-4">
          <ShieldAlert className="h-10 w-10 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Access Restricted</h1>
        <p className="text-muted-foreground mt-2 max-w-md">
          You do not have permission to view billing information. This section is restricted to Tenant Admins.
        </p>
        <Button 
          variant="outline" 
          className="mt-6" 
          onClick={() => router.push('/dashboard')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Return to Dashboard
        </Button>
      </div>
    );
  }

  // =========================================================
  //  MAIN PAGE LOGIC (Only runs if allowed)
  // =========================================================

  // 1. Fetch Plans
  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Plan>>('/api/billing/plans/');
      return data.results;
    },
    enabled: isAllowed, // Don't fetch if not allowed
  });

  // 2. Fetch Subscriptions
  const { data: subscriptions, isLoading: subsLoading } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Subscription>>('/api/billing/subscriptions/');
      return data.results;
    },
    enabled: isAllowed, // Don't fetch if not allowed
  });

  const activeSubscription = subscriptions?.find(
    (sub) => sub.status === 'active' || sub.status === 'pending'
  );

  const getPlanDetails = (planId: number) => plans?.find((p) => p.id === planId);
  const currentPlanDetails = getPlanDetails(activeSubscription?.plan!);
  const isCurrentPlanFree = currentPlanDetails?.name.toLowerCase() === 'free';
  const isActive = activeSubscription?.status === 'active';
  const isCancelling = isActive && !activeSubscription?.auto_renew;

  // 3. Upgrade Mutation
  const upgradeMutation = useMutation({
    mutationFn: async (planId: number) => {
      const response = await api.post('/api/billing/subscriptions/', {
        plan: planId,
        auto_renew: true, 
      });
      return response.data; 
    },
    onSuccess: (data) => {
      const payUrl = data?.data?.authorization_url;
      if (payUrl) {
        toast.loading('Redirecting to Paystack...');
        window.location.href = payUrl;
      } else {
        toast.error('Failed to get payment link.');
      }
    },
    onError: (error) => {
      console.error(error);
      toast.error('Upgrade failed.');
    },
  });

  // 4. Renew Mutation
  const renewMutation = useMutation({
    mutationFn: async (subId: number) => {
      const response = await api.post(`/api/billing/subscriptions/${subId}/renew/`);
      return response.data;
    },
    onSuccess: (data) => {
      const payUrl = data?.payment_url || data?.data?.authorization_url; 
      if (payUrl) {
        toast.loading('Redirecting to Paystack for renewal...');
        window.location.href = payUrl;
      } else {
        toast.error('Failed to get payment link.');
      }
    },
    onError: (error) => {
      console.error(error);
      toast.error('Renewal failed.');
    },
  });

  // 5. Cancel Mutation
  const cancelMutation = useMutation({
    mutationFn: async (subId: number) => {
      await api.post(`/api/billing/subscriptions/${subId}/cancel/`);
    },
    onSuccess: () => {
      toast.success('Auto-renewal disabled.');
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
    },
    onError: () => toast.error('Failed to cancel.'),
  });

  // 6. Resume Mutation
  const resumeMutation = useMutation({
    mutationFn: async (subId: number) => {
      await api.patch(`/api/billing/subscriptions/${subId}/`, {
        auto_renew: true
      });
    },
    onSuccess: () => {
      toast.success('Auto-renewal enabled!');
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
    },
    onError: () => toast.error('Failed to resume subscription.'),
  });

  const handleCancel = () => {
    if (!activeSubscription) return;
    if (confirm('Disable auto-renewal?')) {
      cancelMutation.mutate(activeSubscription.id);
    }
  };

  const handleResume = () => {
    if (!activeSubscription) return;
    resumeMutation.mutate(activeSubscription.id);
  };

  const handleRenewNow = () => {
    if (!activeSubscription) return;
    renewMutation.mutate(activeSubscription.id);
  };

  if (authLoading || (isAllowed && (plansLoading || subsLoading))) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isAdmin = user?.role === 'tenant_admin' || (user as any)?.is_superuser;

  return (
    <div className="space-y-8 pb-10">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Billing & Plans</h1>
            {user?.role && (
              <Badge variant="secondary" className="font-mono text-xs">
                <UserCog className="w-3 h-3 mr-1" />
                {user.role}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">Manage your subscription and billing details.</p>
        </div>
        
        {isAdmin && (
          <Link href="/dashboard/billing/history">
            <Button variant="outline">
              <History className="mr-2 h-4 w-4" /> Transaction History
            </Button>
          </Link>
        )}
      </div>

      {/* --- CURRENT SUBSCRIPTION CARD --- */}
      <Card className="border-l-4 border-l-primary">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Current Subscription</CardTitle>
              <CardDescription>
                Current Plan: <span className="font-semibold text-foreground">{currentPlanDetails?.name || 'Free Trial'}</span>
              </CardDescription>
            </div>
            {isCancelling ? (
               <Badge className="bg-amber-600 hover:bg-amber-700">
                 Cancels on {activeSubscription?.expires_at ? format(new Date(activeSubscription.expires_at), 'MMM d') : ''}
               </Badge>
            ) : (
               <Badge className={`capitalize ${isActive ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-500'}`}>
                 {activeSubscription?.status || 'No Active Plan'}
               </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Start Date</p>
              <p className="font-medium">
                {activeSubscription?.started_at ? format(new Date(activeSubscription.started_at), 'PPP') : '-'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Renews / Expires On</p>
              <p className="font-medium">
                {activeSubscription?.expires_at ? format(new Date(activeSubscription.expires_at), 'PPP') : '-'}
              </p>
            </div>
          </div>
          {activeSubscription?.status === 'pending' && (
             <div className="mt-4 flex items-center gap-2 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
                <AlertTriangle className="h-4 w-4" />
                <span>You have a pending payment. Please verify it or start a new one.</span>
             </div>
          )}
        </CardContent>

        {isActive && !isCurrentPlanFree && (
          <CardFooter className={`border-t px-6 py-3 flex flex-col sm:flex-row gap-3 items-center justify-between ${isCancelling ? 'bg-amber-50' : 'bg-muted/50'}`}>
             
             {isCancelling ? (
                <div className="flex flex-1 items-center gap-4">
                  <span className="text-sm text-amber-800 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Expires on {format(new Date(activeSubscription?.expires_at!), 'PPP')}
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleResume}
                    disabled={resumeMutation.isPending}
                    className="border-amber-200 hover:bg-amber-100 text-amber-900 ml-auto sm:ml-0"
                  >
                    {resumeMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4"/>}
                    Resume Auto-Renewal
                  </Button>
                </div>
             ) : (
                <div className="flex flex-1 items-center justify-between sm:justify-start sm:gap-4 w-full">
                  <span className="text-sm text-muted-foreground">Need to stop auto-renewal?</span>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={handleCancel}
                    disabled={cancelMutation.isPending}
                  >
                    {cancelMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <XCircle className="mr-2 h-4 w-4"/>}
                    Cancel Auto-Renewal
                  </Button>
                </div>
             )}

             <div className="w-full sm:w-auto mt-2 sm:mt-0">
               <Button 
                 variant="secondary" 
                 size="sm" 
                 onClick={handleRenewNow}
                 disabled={renewMutation.isPending}
                 className="w-full sm:w-auto"
               >
                 {renewMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CalendarPlus className="mr-2 h-4 w-4"/>}
                 Pay Now / Extend
               </Button>
             </div>
          </CardFooter>
        )}
      </Card>

      {/* --- PLANS GRID --- */}
      <div>
        <h2 className="mb-4 text-xl font-semibold">Available Plans</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {plans?.map((plan) => {
            const isCurrent = activeSubscription?.plan === plan.id;
            const isFreePlan = plan.name.toLowerCase() === 'free';
            const isTrialOnly = isFreePlan && !isCurrent;
            
            return (
              <Card key={plan.id} className={`flex flex-col ${isCurrent ? 'border-primary ring-1 ring-primary' : ''}`}>
                <CardHeader>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="mb-4">
                    <span className="text-3xl font-bold">₦{plan.amount.toLocaleString()}</span>
                    <span className="text-muted-foreground"> / {plan.duration_days} days</span>
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center"><Check className="mr-2 h-4 w-4 text-green-500" /> Inventory Management</li>
                    <li className="flex items-center"><Check className="mr-2 h-4 w-4 text-green-500" /> Sales & Orders</li>
                    {plan.amount > 0 && (
                      <>
                         <li className="flex items-center"><Check className="mr-2 h-4 w-4 text-green-500" /> Advanced Reports</li>
                         <li className="flex items-center"><Check className="mr-2 h-4 w-4 text-green-500" /> Email Notifications</li>
                      </>
                    )}
                    {plan.amount >= 15000 && <li className="flex items-center"><Check className="mr-2 h-4 w-4 text-green-500" /> Priority Support</li>}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button 
                    className="w-full" 
                    variant={isCurrent ? "outline" : "default"}
                    disabled={isCurrent || upgradeMutation.isPending || isTrialOnly}
                    onClick={() => upgradeMutation.mutate(plan.id)}
                  >
                    {upgradeMutation.isPending && !isCurrent ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : isCurrent ? "Current Plan" : isTrialOnly ? "Trial Only" : <><CreditCard className="mr-2 h-4 w-4" /> Upgrade</>}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}