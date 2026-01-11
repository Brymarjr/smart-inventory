'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { PaginatedResponse } from '@/lib/types';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { 
    Search, 
    Loader2, 
    CheckCircle, 
    CreditCard, 
    Eye, 
    XCircle,
    ChevronLeft,
    ChevronRight,
    Plus
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';

// ✅ Import New Dialogs
import { ApproveDialog } from '@/components/purchases/approve-dialog';
import { MarkPaidDialog } from '@/components/purchases/mark-paid-dialog';

interface PurchaseItem {
  id: number;
  product_name: string;
  quantity: number;
  unit_cost: string;
  subtotal: string;
  new_price?: string; 
}

interface PurchaseOrder {
  id: number;
  reference: string;
  supplier_name: string | null;
  status: 'pending' | 'approved_pending_payment' | 'paid' | 'cancelled';
  total_amount: string;
  created_at: string;
  items: PurchaseItem[];
}

export default function PurchasesPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  
  const [viewPO, setViewPO] = useState<PurchaseOrder | null>(null);
  const [approvePO, setApprovePO] = useState<PurchaseOrder | null>(null);
  const [paidPO, setPaidPO] = useState<PurchaseOrder | null>(null);
  
  const queryClient = useQueryClient();

  const isFinance = user?.role === 'tenant_admin' || user?.role === 'manager';

  const { data, isLoading } = useQuery({
    queryKey: ['purchases', search, page],
    queryFn: async () => {
      const params = { search, page, page_size: 20 };
      const { data } = await api.get<PaginatedResponse<PurchaseOrder>>('/api/purchases/', { params });
      return data;
    },
    placeholderData: (previousData) => previousData,
  });

  const rejectMutation = useMutation({
    mutationFn: async (poId: number) => {
        await api.post(`/api/purchases/${poId}/reject/`);
    },
    onSuccess: () => {
        toast.info('Purchase Order Rejected');
        queryClient.invalidateQueries({ queryKey: ['purchases'] });
        setViewPO(null); // Close view dialog if open
    },
    onError: () => toast.error('Failed to reject order.')
  });

  const getStatusColor = (status: string) => {
    switch(status) {
        case 'paid': return 'bg-green-100 text-green-800 border-green-200';
        case 'approved_pending_payment': return 'bg-blue-100 text-blue-800 border-blue-200';
        case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
        default: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value);
      setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Purchases</h1>
        <Link href="/dashboard/purchases/create">
            <Button><Plus className="mr-2 h-4 w-4" /> New Request</Button>
        </Link>
      </div>

      <Card>
        <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
                <CardTitle className="text-base">Order History</CardTitle>
                <div className="relative w-64">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search PO or Supplier..." 
                        className="pl-8 h-9" 
                        value={search}
                        onChange={handleSearch}
                    />
                </div>
            </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
             <div className="h-48 flex items-center justify-center"><Loader2 className="animate-spin text-muted-foreground" /></div>
          ) : data?.results.length === 0 ? (
             <div className="h-48 flex flex-col items-center justify-center text-muted-foreground">
                <p>No purchase orders found.</p>
             </div>
          ) : (
            <>
            <div className="rounded-md border">
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>PO Ref</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data?.results.map((po) => (
                    <TableRow key={po.id}>
                        <TableCell className="font-mono font-medium">{po.reference}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(po.created_at), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>{po.supplier_name || '-'}</TableCell>
                        <TableCell>
                            <Badge variant="outline" className={`border ${getStatusColor(po.status)}`}>
                                {po.status.replace(/_/g, ' ')}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-right font-bold">
                             {/* Only show total if approved/paid (since staff doesn't see cost) */}
                             {po.total_amount !== "0.00" ? `₦${parseFloat(po.total_amount).toLocaleString()}` : '-'}
                        </TableCell>
                        <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => setViewPO(po)}>
                                <Eye className="h-4 w-4" />
                            </Button>
                        </TableCell>
                    </TableRow>
                    ))}
                </TableBody>
                </Table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between space-x-2 py-4">
                <div className="text-sm text-muted-foreground">
                    {data?.count ? (
                        <span>
                            Showing <strong>{(page - 1) * 20 + 1}</strong> to <strong>{Math.min(page * 20, data.count)}</strong> of <strong>{data.count}</strong> results
                        </span>
                    ) : "0 results"}
                </div>
                <div className="space-x-2">
                    <Button variant="outline" size="sm" onClick={() => setPage(old => Math.max(old - 1, 1))} disabled={page === 1 || isLoading}>
                        <ChevronLeft className="h-4 w-4 mr-2" /> Previous
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setPage(old => old + 1)} disabled={!data?.next || isLoading}>
                        Next <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                </div>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* --- VIEW DIALOG (READ ONLY) --- */}
      <Dialog open={!!viewPO} onOpenChange={(open) => !open && setViewPO(null)}>
        <DialogContent className="max-w-2xl">
            <DialogHeader>
                <DialogTitle>Purchase Order {viewPO?.reference}</DialogTitle>
                <DialogDescription>
                    Status: <span className="font-medium capitalize">{viewPO?.status.replace(/_/g, ' ')}</span>
                </DialogDescription>
            </DialogHeader>

            {viewPO && (
                <div className="space-y-6 py-2">
                    <div className="border rounded-md overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50">
                                    <TableHead>Product</TableHead>
                                    <TableHead className="text-right">Qty</TableHead>
                                    {isFinance && viewPO.total_amount !== "0.00" && (
                                         <TableHead className="text-right">Unit Cost</TableHead>
                                    )}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {viewPO.items.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell>{item.product_name}</TableCell>
                                        <TableCell className="text-right">{item.quantity}</TableCell>
                                        {isFinance && viewPO.total_amount !== "0.00" && (
                                            <TableCell className="text-right">₦{parseFloat(item.unit_cost).toLocaleString()}</TableCell>
                                        )}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {/* ACTIONS */}
                    <div className="flex justify-end gap-2">
                        {/* APPROVE BUTTON */}
                        {viewPO.status === 'pending' && isFinance && (
                            <>
                                <Button variant="destructive" onClick={() => rejectMutation.mutate(viewPO.id)}>
                                    <XCircle className="mr-2 h-4 w-4" /> Reject
                                </Button>
                                <Button onClick={() => { setViewPO(null); setApprovePO(viewPO); }}>
                                    <CheckCircle className="mr-2 h-4 w-4" /> Review & Approve
                                </Button>
                            </>
                        )}

                        {/* PAY BUTTON */}
                        {viewPO.status === 'approved_pending_payment' && isFinance && (
                            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => { setViewPO(null); setPaidPO(viewPO); }}>
                                <CreditCard className="mr-2 h-4 w-4" /> Mark as Paid
                            </Button>
                        )}
                    </div>
                </div>
            )}
        </DialogContent>
      </Dialog>

      {/* --- NEW ACTION DIALOGS --- */}
      {approvePO && (
        <ApproveDialog 
            isOpen={!!approvePO} 
            onClose={() => setApprovePO(null)} 
            purchase={approvePO} 
        />
      )}

      {paidPO && (
        <MarkPaidDialog 
            isOpen={!!paidPO} 
            onClose={() => setPaidPO(null)} 
            purchase={paidPO} 
        />
      )}

    </div>
  );
}