'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Transaction, PaginatedResponse } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2, ArrowLeft, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';

export default function TransactionHistoryPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState('');

  // 1. RBAC PROTECTION
  // If Auth is done loading, and user is NOT an admin, block access.
  if (!authLoading && user?.role !== 'tenant_admin') {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center text-center">
        <ShieldAlert className="h-16 w-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground mt-2 max-w-md">
          You do not have permission to view transaction history. This page is restricted to Tenant Administrators.
        </p>
        <Button 
          variant="outline" 
          className="mt-6" 
          onClick={() => router.push('/dashboard/billing')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Billing
        </Button>
      </div>
    );
  }

  // 2. Fetch Transactions
  const { data, isLoading: dataLoading } = useQuery({
    queryKey: ['transactions', search],
    queryFn: async () => {
      const params = search ? { search } : {};
      const response = await api.get<PaginatedResponse<Transaction>>('/api/billing/transactions/', { params });
      return response.data;
    },
    enabled: !!user, // Only fetch if user exists
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transaction History</h1>
          <p className="text-muted-foreground">Audit log of all subscription payments.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Payments</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search reference..." 
                className="pl-8" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {dataLoading || authLoading ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mr-2" /> Loading transactions...
            </div>
          ) : data?.results.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-muted-foreground">
               <p>No transactions found.</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.results.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {tx.reference}
                      </TableCell>
                      <TableCell>
                        {format(new Date(tx.created_at), 'PPP p')}
                      </TableCell>
                      <TableCell>
                        ₦{tx.amount.toLocaleString()}
                      </TableCell>
                      <TableCell>
                         <Badge variant={
                           tx.status === 'success' ? 'default' : 
                           tx.status === 'pending' ? 'secondary' : 'destructive'
                         } className={
                           tx.status === 'success' ? 'bg-green-600 hover:bg-green-700' : ''
                         }>
                           {tx.status}
                         </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}