'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/lib/api';
import { SystemTenantDetail, AuditLog } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeft, Building, User, Power, ShieldAlert, Users, Clock, Calendar, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

// ✅ Import the Training Card
import { TenantTrainingCard } from '@/components/admin/tenant-training-card';

export default function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params); // Unwrap params for Next.js 15

  // --- STATE ---
  // Tenant State
  const [tenant, setTenant] = useState<SystemTenantDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);

  // Audit Logs State
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  // Billing State
  const [subscription, setSubscription] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [extendDays, setExtendDays] = useState("30");
  const [isExtending, setIsExtending] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // --- EFFECTS ---

  // 1. Fetch Tenant Details
  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await adminApi.getTenantDetails(id);
        setTenant(data);
      } catch (error) {
        toast.error("Failed to load organization details");
        router.push('/system-admin');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [id, router]);

  // 2. Fetch Audit Logs
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const data = await adminApi.getTenantAuditLogs(id);
        setLogs(data.results);
      } catch (error) {
        console.error("Failed to load audit logs");
      } finally {
        setLogsLoading(false);
      }
    };
    if (id) fetchLogs();
  }, [id]);

  // 3. Fetch Billing Data
  useEffect(() => {
    const fetchBilling = async () => {
      try {
        const subData = await adminApi.getTenantSubscription(id);
        const transData = await adminApi.getTenantTransactions(id);
        setSubscription(subData);
        setTransactions(transData);
      } catch (error) {
        console.error("Failed to load billing info");
      }
    };
    if (id) fetchBilling();
  }, [id]);

  // --- HANDLERS ---

  // Suspend/Activate
  const handleToggleStatus = async () => {
    if (!tenant) return;
    setIsToggling(true);
    try {
      const data = await adminApi.toggleTenantStatus(tenant.id.toString());
      setTenant(prev => prev ? { ...prev, is_active: data.is_active } : null);
      toast.success(`Organization is now ${data.status}`);
    } catch (error) {
      toast.error("Failed to update status");
    } finally {
      setIsToggling(false);
    }
  };

  // Extend Subscription
  const handleExtend = async () => {
    if (!subscription) return;
    setIsExtending(true);
    try {
      await adminApi.extendSubscription(subscription.id, parseInt(extendDays));
      toast.success(`Successfully added ${extendDays} days!`);
      
      // Refresh Subscription Data
      const subData = await adminApi.getTenantSubscription(id);
      setSubscription(subData);
      setIsDialogOpen(false);
    } catch (error) {
      toast.error("Failed to extend subscription");
    } finally {
      setIsExtending(false);
    }
  };

  // --- RENDER ---

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!tenant) return null;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {tenant.name}
              {tenant.is_active ? (
                <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200 border">Active</Badge>
              ) : (
                <Badge variant="destructive">Suspended</Badge>
              )}
            </h1>
            <p className="text-slate-500">Slug: {tenant.slug} • Joined: {new Date(tenant.created_at).toLocaleDateString()}</p>
          </div>
        </div>
        
        <Button 
          variant={tenant.is_active ? "destructive" : "default"} 
          onClick={handleToggleStatus}
          disabled={isToggling}
        >
          {isToggling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Power className="mr-2 h-4 w-4" />}
          {tenant.is_active ? "Suspend Organization" : "Activate Organization"}
        </Button>
      </div>

      {/* DETAILS GRID */}
      <div className="grid gap-6 md:grid-cols-2">
        
        {/* PRIMARY CONTACT CARD */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5 text-slate-500" />
              Primary Contact (Creator)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between border-b pb-2">
              <span className="text-slate-500">Full Name</span>
              <span className="font-medium">
                {tenant.admin_info?.full_name || "Unknown"}
              </span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-slate-500">Email</span>
              <span className="font-medium">
                {tenant.admin_info?.email || "No email found"}
              </span>
            </div>
            <div className="flex justify-between pt-2 items-center">
              <span className="text-slate-500">Total Admins</span>
              <Badge variant="secondary" className="flex gap-1">
                <Users className="h-3 w-3" />
                {tenant.admin_info?.total_admins || 0} Users
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* STORE PROFILE CARD */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building className="h-5 w-5 text-slate-500" />
              Store Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between border-b pb-2">
              <span className="text-slate-500">Store Name</span>
              <span className="font-medium">{tenant.settings?.store_name || tenant.name}</span>
            </div>
            <div className="flex justify-between border-b py-2">
              <span className="text-slate-500">Currency</span>
              <span className="font-medium">{tenant.settings?.currency_symbol || "N/A"}</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-slate-500">Address</span>
              <span className="font-medium truncate max-w-[200px]">{tenant.settings?.store_address || "No address set"}</span>
            </div>
          </CardContent>
        </Card>

        {/* ✅ NEW: AI MODEL TRAINING CARD */}
        <TenantTrainingCard tenantId={tenant.id.toString()} tenantName={tenant.name} />

      </div>

      {/* TABS (Audit Logs & Billing) */}
      <Tabs defaultValue="activity" className="w-full">
        <TabsList>
          <TabsTrigger value="activity">Audit Logs</TabsTrigger>
          <TabsTrigger value="billing">Subscription</TabsTrigger>
        </TabsList>
        
        {/* ACTIVITY TAB: Audit Logs */}
        <TabsContent value="activity" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Actions performed by users in this organization.</CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-500 bg-slate-50 rounded-lg border border-dashed">
                  <ShieldAlert className="h-10 w-10 mb-2 opacity-20" />
                  <p>No activity recorded yet.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{log.actor_name || "System"}</span>
                            <span className="text-xs text-slate-500">{log.actor_email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal capitalize">
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {log.target_model} • {log.target_name}
                        </TableCell>
                        <TableCell className="text-sm text-slate-500">
                          {new Date(log.timestamp).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* BILLING TAB: Subscription & Transactions */}
        <TabsContent value="billing" className="pt-4 space-y-6">
           
           {/* 1. SUBSCRIPTION STATUS CARD */}
           <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Current Plan</CardTitle>
                <CardDescription>Manage subscription status and validity.</CardDescription>
              </div>
              {subscription && (
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="border-amber-200 text-amber-700 hover:bg-amber-50">
                      <Clock className="mr-2 h-4 w-4" />
                      Gift / Extend Days
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Extend Subscription</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                      <Label>Days to Add</Label>
                      <Input 
                        type="number" 
                        value={extendDays} 
                        onChange={(e) => setExtendDays(e.target.value)} 
                        className="mt-2"
                      />
                      <p className="text-sm text-slate-500 mt-2">
                        This will push the expiration date forward by the specified number of days.
                      </p>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleExtend} disabled={isExtending}>
                        {isExtending ? "Processing..." : "Confirm Extension"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              {!subscription ? (
                <div className="text-center py-6 text-slate-500">
                  <p>No active subscription found.</p>
                  <Badge variant="outline" className="mt-2">Free / Trial</Badge>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="p-4 bg-slate-50 rounded-lg border">
                    <p className="text-xs text-slate-500 uppercase font-semibold">Plan</p>
                    <p className="text-xl font-bold text-primary mt-1">
                      {subscription.plan_name || "Custom / Unknown"}
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg border">
                    <p className="text-xs text-slate-500 uppercase font-semibold">Status</p>
                    <div className="flex items-center gap-2 mt-1">
                      {subscription.status === 'active' 
                        ? <CheckCircle className="h-5 w-5 text-green-500" /> 
                        : <XCircle className="h-5 w-5 text-red-500" />
                      }
                      <span className="text-lg font-medium capitalize">{subscription.status}</span>
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg border">
                    <p className="text-xs text-slate-500 uppercase font-semibold">Expires On</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Calendar className="h-5 w-5 text-slate-400" />
                      <span className="text-lg font-medium">
                        {subscription.expires_at 
                          ? new Date(subscription.expires_at).toLocaleDateString() 
                          : "Lifetime / No Expiry"
                        }
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
           </Card>

           {/* 2. TRANSACTION HISTORY TABLE */}
           <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <div className="text-center text-slate-500 py-8 border border-dashed rounded-lg bg-slate-50">
                  <p>No transactions found.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="font-mono text-xs">{tx.reference}</TableCell>
                        <TableCell className="font-medium">
                           {tx.currency} {parseFloat(tx.amount).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant={tx.status === 'success' ? 'default' : 'destructive'} className={tx.status === 'success' ? 'bg-green-600 hover:bg-green-700' : ''}>
                            {tx.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-500 text-sm">
                          {new Date(tx.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
           </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}