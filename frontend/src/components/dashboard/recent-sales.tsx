'use client';

import { useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { PaginatedResponse } from '@/lib/types'; // Using your existing types

interface Sale {
  id: number;
  customer_name: string;
  reference: string;
  created_at: string;
  total_amount: string;
}

export function RecentSales() {
  const [page, setPage] = useState(1);
  const pageSize = 5;

  const { data, isLoading } = useQuery({
    queryKey: ['recent-sales', page], // Key changes when page changes
    queryFn: async () => {
      // Fetch specific page
      const res = await api.get<PaginatedResponse<Sale>>(
        `/api/sales/?ordering=-created_at&page_size=${pageSize}&page=${page}`
      );
      return res.data;
    },
  });

  if (isLoading) {
    return (
        <div className="flex justify-center p-8">
            <Loader2 className="animate-spin h-5 w-5 text-muted-foreground" />
        </div>
    );
  }

  if (!data?.results || data.results.length === 0) {
    return <div className="p-4 text-sm text-muted-foreground">No sales recorded.</div>;
  }

  const totalPages = Math.ceil((data.count || 0) / pageSize);

  return (
    <div className="space-y-6">
      <div className="space-y-8">
        {data.results.map((sale) => (
          <div key={sale.id} className="flex items-center">
            <Avatar className="h-9 w-9">
              <AvatarFallback>
                {sale.customer_name 
                    ? sale.customer_name.substring(0, 2).toUpperCase() 
                    : 'CU'}
              </AvatarFallback>
            </Avatar>
            <div className="ml-4 space-y-1">
              <p className="text-sm font-medium leading-none">
                  {sale.customer_name || 'Walk-in Customer'}
              </p>
              <p className="text-xs text-muted-foreground">
                {sale.reference} • {new Date(sale.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="ml-auto font-medium">
               +₦{parseFloat(sale.total_amount).toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* ✅ Pagination Footer */}
      <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
          </div>
          <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={!data.previous}
                title="Previous Page"
              >
                  <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => setPage(p => p + 1)}
                disabled={!data.next}
                title="Next Page"
              >
                  <ChevronRight className="h-4 w-4" />
              </Button>
          </div>
      </div>
    </div>
  );
}