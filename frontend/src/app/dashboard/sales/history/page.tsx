'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { PaginatedResponse } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Search, Loader2, Eye, Calendar, User, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

// 1. UPDATE INTERFACE to include product_name
interface SaleItem {
  id: number;
  product_name?: string; // <--- ADDED (Matches the backend update)
  product: number;
  quantity: number;
  unit_price: string;
  subtotal: string;
}

interface Sale {
  id: number;
  reference: string;
  customer_name: string | null;
  total_amount: string;
  payment_method: string;
  created_by: string; 
  created_at: string;
  notes: string | null;
  items: SaleItem[];
}

export default function SalesHistoryPage() {
  const [search, setSearch] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['sales', search],
    queryFn: async () => {
      const params = search ? { search } : {};
      const { data } = await api.get<PaginatedResponse<Sale>>('/api/sales/', { params });
      return data;
    },
  });

  const fmtMoney = (amount: string | number) => 
    `₦${parseFloat(amount as string).toLocaleString()}`;

  const getBadgeVariant = (method: string) => {
    switch (method) {
      case 'cash': return 'default'; 
      case 'transfer': return 'secondary';
      case 'pos': return 'outline';
      default: return 'outline';
    }
  };

  // 2. NEW HELPER: Remove the "1__" prefix from usernames
  const formatCashier = (rawName: string) => {
    if (!rawName) return 'Unknown';
    // If name is "1__john", split by "__" and take the last part
    const parts = rawName.split('__');
    return parts.length > 1 ? parts[parts.length - 1] : rawName;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
           <h1 className="text-2xl font-bold tracking-tight">Sales History</h1>
           <p className="text-muted-foreground text-sm">View past transactions and receipts.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
                <CardTitle className="text-base">Transactions</CardTitle>
                <div className="relative w-64">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search Reference ID..." 
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
                <p>No sales records found.</p>
             </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Cashier</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.results.map((sale) => (
                    <TableRow key={sale.id} className="group">
                      <TableCell className="font-mono font-medium">{sale.reference}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(sale.created_at), 'MMM d, yyyy HH:mm')}
                      </TableCell>
                      <TableCell>{sale.customer_name || 'Walk-in'}</TableCell>
                      <TableCell>
                        <Badge variant={getBadgeVariant(sale.payment_method)} className="capitalize">
                            {sale.payment_method}
                        </Badge>
                      </TableCell>
                      
                      {/* 3. APPLY HELPER HERE */}
                      <TableCell className="text-sm text-muted-foreground">
                        {formatCashier(sale.created_by)}
                      </TableCell>
                      
                      <TableCell className="text-right font-bold">{fmtMoney(sale.total_amount)}</TableCell>
                      <TableCell>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setSelectedSale(sale)}
                            className="h-8 w-8 text-gray-400 group-hover:text-primary transition-colors"
                        >
                            <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* --- TRANSACTION DETAILS DIALOG --- */}
      <Dialog open={!!selectedSale} onOpenChange={(open) => !open && setSelectedSale(null)}>
        <DialogContent className="max-w-md">
            <DialogHeader>
                <DialogTitle className="flex justify-between items-center pr-4">
                    <span>Receipt Details</span>
                    <span className="font-mono text-sm font-normal text-muted-foreground">{selectedSale?.reference}</span>
                </DialogTitle>
                <DialogDescription>
                    Transaction on {selectedSale && format(new Date(selectedSale.created_at), 'PPP p')}
                </DialogDescription>
            </DialogHeader>

            {selectedSale && (
                <div className="space-y-6">
                    {/* Items List */}
                    <div className="bg-slate-50 p-4 rounded-md space-y-3 max-h-[300px] overflow-y-auto">
                        {selectedSale.items?.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                                <div>
                                    {/* 4. USE product_name IF AVAILABLE, ELSE FALLBACK */}
                                    <span className="font-medium text-slate-700">
                                      {item.product_name || `Product #${item.product}`}
                                    </span>
                                    <div className="text-xs text-muted-foreground">
                                        {item.quantity} x {fmtMoney(item.unit_price)}
                                    </div>
                                </div>
                                <div className="font-medium text-slate-900">
                                    {fmtMoney(item.subtotal)}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Meta Details */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <User className="h-4 w-4" />
                            {/* 5. APPLY HELPER HERE TOO */}
                            <span>{formatCashier(selectedSale.created_by)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <CreditCard className="h-4 w-4" />
                            <span className="capitalize">{selectedSale.payment_method}</span>
                        </div>
                    </div>

                    {/* Total */}
                    <div className="flex justify-between items-center border-t pt-4">
                        <span className="font-bold text-lg">Total Paid</span>
                        <span className="font-bold text-2xl text-primary">{fmtMoney(selectedSale.total_amount)}</span>
                    </div>

                    {selectedSale.notes && (
                        <div className="bg-yellow-50 p-3 rounded text-xs text-yellow-800 border border-yellow-100">
                            <strong>Note:</strong> {selectedSale.notes}
                        </div>
                    )}
                </div>
            )}
        </DialogContent>
      </Dialog>
    </div>
  );
}