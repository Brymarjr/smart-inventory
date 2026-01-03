'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { PaginatedResponse, Supplier } from '@/lib/types';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, Loader2, CheckCircle, CreditCard, Eye, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '@/lib/auth-context';

interface PurchaseItem {
  id: number;
  product_name: string;
  quantity: number;
  unit_cost: string;
  subtotal: string;
  new_price?: string; // This comes from backend if set
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
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [priceUpdates, setPriceUpdates] = useState<Record<number, string>>({});
  
  const queryClient = useQueryClient();

  // RBAC: Check if user is Finance/Admin
  const isFinance = user?.role === 'tenant_admin' || user?.role === 'manager';

  // Fetch Purchases
  const { data, isLoading } = useQuery({
    queryKey: ['purchases', search],
    queryFn: async () => {
      const params = search ? { search } : {};
      const { data } = await api.get<PaginatedResponse<PurchaseOrder>>('/api/purchases/', { params });
      return data;
    },
  });

  // Fetch Suppliers (Only needed for Approval)
  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Supplier>>('/api/suppliers/');
      return data.results;
    },
    enabled: !!selectedPO && selectedPO.status === 'pending' && isFinance,
  });

  // --- ACTIONS ---

  const approveMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/api/purchases/${selectedPO?.id}/approve/`, { supplier: selectedSupplier });
    },
    onSuccess: () => {
      toast.success('Purchase Order Approved');
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      setSelectedPO(null);
    },
    onError: () => toast.error('Failed to approve order.')
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
        if(!selectedPO) return;
        await api.post(`/api/purchases/${selectedPO.id}/reject/`);
    },
    onSuccess: () => {
        toast.info('Purchase Order Rejected');
        queryClient.invalidateQueries({ queryKey: ['purchases'] });
        setSelectedPO(null);
    },
    onError: () => toast.error('Failed to reject order.')
  });

  const payMutation = useMutation({
    mutationFn: async () => {
      if(!selectedPO) return;
      const itemsPayload = selectedPO.items.map(item => ({
        id: item.id,
        new_price: priceUpdates[item.id] || item.unit_cost 
      }));
      await api.post(`/api/purchases/${selectedPO.id}/mark_paid/`, { items: itemsPayload });
    },
    onSuccess: () => {
      toast.success('Payment Recorded & Stock Updated');
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['products'] }); 
      setSelectedPO(null);
    },
    onError: () => toast.error('Failed to process payment.')
  });

  const getStatusColor = (status: string) => {
    switch(status) {
        case 'paid': return 'bg-green-100 text-green-800 hover:bg-green-100 border-green-200';
        case 'approved_pending_payment': return 'bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200';
        case 'cancelled': return 'bg-red-100 text-red-800 hover:bg-red-100 border-red-200';
        default: return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-200';
    }
  };

  // Determine if we should show the "New Price" column
  // Show if: (Status is PAID) OR (Status is APPROVED AND User is Finance)
  const showNewPriceColumn = selectedPO && (
    selectedPO.status === 'paid' || 
    (selectedPO.status === 'approved_pending_payment' && isFinance)
  );

  return (
    <div className="space-y-6">
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
                        onChange={(e) => setSearch(e.target.value)}
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
                    <TableCell className="text-right font-bold">₦{parseFloat(po.total_amount).toLocaleString()}</TableCell>
                    <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => setSelectedPO(po)}>
                            <Eye className="h-4 w-4" />
                        </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* --- DETAIL & ACTION DIALOG --- */}
      <Dialog open={!!selectedPO} onOpenChange={(open) => !open && setSelectedPO(null)}>
        <DialogContent className="max-w-2xl">
            <DialogHeader>
                <DialogTitle>Purchase Order {selectedPO?.reference}</DialogTitle>
                <DialogDescription>
                    Status: <span className="font-medium capitalize">{selectedPO?.status.replace(/_/g, ' ')}</span>
                </DialogDescription>
            </DialogHeader>

            {selectedPO && (
                <div className="space-y-6 py-2">
                    {/* ITEMS TABLE */}
                    <div className="border rounded-md overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50">
                                    <TableHead>Product</TableHead>
                                    <TableHead className="text-right">Qty</TableHead>
                                    <TableHead className="text-right">Unit Cost</TableHead>
                                    
                                    {/* Dynamic Column: New Sell Price */}
                                    {showNewPriceColumn && (
                                        <TableHead className="text-right w-[140px]">New Sell Price</TableHead>
                                    )}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {selectedPO.items.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell>{item.product_name}</TableCell>
                                        <TableCell className="text-right">{item.quantity}</TableCell>
                                        <TableCell className="text-right">₦{parseFloat(item.unit_cost).toLocaleString()}</TableCell>
                                        
                                        {/* CASE 1: PAID - Show confirmed new price */}
                                        {selectedPO.status === 'paid' && (
                                            <TableCell className="text-right font-medium text-blue-700">
                                                {item.new_price ? `₦${parseFloat(item.new_price).toLocaleString()}` : '-'}
                                            </TableCell>
                                        )}

                                        {/* CASE 2: PAYMENT PHASE - Show Input */}
                                        {selectedPO.status === 'approved_pending_payment' && isFinance && (
                                            <TableCell>
                                                <Input 
                                                    type="number" 
                                                    className="h-8 text-right"
                                                    placeholder={item.unit_cost} 
                                                    value={priceUpdates[item.id] || ''}
                                                    onChange={(e) => setPriceUpdates(prev => ({...prev, [item.id]: e.target.value}))}
                                                />
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {/* --- ACTION AREA: APPROVE / REJECT --- */}
                    {selectedPO.status === 'pending' && isFinance && (
                        <div className="bg-slate-50 p-4 rounded-md border space-y-3">
                            <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                                <CheckCircle className="h-4 w-4" /> Action Required
                            </h4>
                            <div className="space-y-2">
                                <Label>Assign Supplier</Label>
                                <Select onValueChange={setSelectedSupplier}>
                                    <SelectTrigger className="bg-white">
                                        <SelectValue placeholder="Select Supplier..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {suppliers?.map(s => (
                                            <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <Button 
                                    className="flex-1" 
                                    onClick={() => approveMutation.mutate()} 
                                    disabled={!selectedSupplier || approveMutation.isPending}
                                >
                                    {approveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Approve
                                </Button>
                                {/* REJECT BUTTON ADDED */}
                                <Button 
                                    variant="destructive"
                                    onClick={() => rejectMutation.mutate()}
                                    disabled={rejectMutation.isPending}
                                >
                                    {rejectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* --- ACTION AREA: PAY / REJECT --- */}
                    {selectedPO.status === 'approved_pending_payment' && isFinance && (
                        <div className="bg-blue-50 p-4 rounded-md border border-blue-100 space-y-3">
                             <h4 className="font-semibold text-blue-900 flex items-center gap-2">
                                <CreditCard className="h-4 w-4" /> Action Required: Payment
                            </h4>
                            <p className="text-sm text-blue-800">
                                Confirming payment will release funds and <strong>add stock</strong>. 
                                Enter "New Sell Price" above (defaults to cost if left empty).
                            </p>
                            <div className="flex gap-2">
                                <Button 
                                    className="flex-1 bg-blue-600 hover:bg-blue-700" 
                                    onClick={() => payMutation.mutate()}
                                    disabled={payMutation.isPending}
                                >
                                    {payMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Confirm Payment
                                </Button>
                                {/* REJECT BUTTON ADDED */}
                                <Button 
                                    variant="destructive"
                                    onClick={() => rejectMutation.mutate()}
                                    disabled={rejectMutation.isPending}
                                >
                                    {rejectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </DialogContent>
      </Dialog>
    </div>
  );
}