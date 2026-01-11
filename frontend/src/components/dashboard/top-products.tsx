'use client';

import { Trophy } from 'lucide-react';

interface Props {
  data: Array<{
    product__name: string;
    total_sold: number;
    total_revenue: number;
  }>;
}

export function TopProducts({ data }: Props) {
  if (!data || data.length === 0) {
    return <div className="text-sm text-muted-foreground">No sales data yet.</div>;
  }

  return (
    <div className="space-y-6">
      {data.map((item, index) => (
        <div key={index} className="flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold">
                 #{index + 1}
              </div>
              <div className="space-y-1">
                 <p className="text-sm font-medium leading-none">{item.product__name}</p>
                 <p className="text-xs text-muted-foreground">{item.total_sold} units sold</p>
              </div>
           </div>
           <div className="text-sm font-medium">
              ₦{item.total_revenue?.toLocaleString()}
           </div>
        </div>
      ))}
    </div>
  );
}