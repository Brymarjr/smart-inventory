'use client';

import { useQuery } from '@tanstack/react-query';
import { salesService } from '@/services/salesService';
import { StatCard } from '@/components/dashboard/stat-card';
import { RecentSales } from '@/components/dashboard/recent-sales'; // ✅ Import
import { TopProducts } from '@/components/dashboard/top-products'; // ✅ Import
import { DollarSign, TrendingUp, Package, AlertTriangle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function DashboardPage() {
  
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: salesService.getDashboardStats,
  });

  if (isLoading) {
    return (
        <div className="flex h-[50vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
    );
  }

  const formatMoney = (amount: number) => {
    return `₦${amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '0.00'}`;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      
      {/* 4 Main Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
            title="Total Revenue"
            value={formatMoney(stats?.revenue.value || 0)}
            icon={DollarSign}
            trend={stats?.revenue.trend}
        />
        <StatCard 
            title="Total Profit"
            value={formatMoney(stats?.profit.value || 0)}
            icon={TrendingUp}
            trend={stats?.profit.trend}
        />
        <StatCard 
            title="Active Products"
            value={stats?.product_count || 0}
            icon={Package}
            description="Total items in catalog"
        />
        <StatCard 
            title="Low Stock"
            value={stats?.low_stock || 0}
            icon={AlertTriangle}
            description="Items below reorder level"
        />
      </div>
      
      {/* Bottom Section: Recent Sales & Top Products */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        
        {/* Recent Sales Widget */}
        <Card className="col-span-4">
            <CardHeader>
                <CardTitle>Recent Sales</CardTitle>
                <CardDescription>
                    Latest transactions from your store.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <RecentSales /> 
            </CardContent>
        </Card>

        {/* Top Products Widget */}
        <Card className="col-span-3">
            <CardHeader>
                <CardTitle>Top Selling Products</CardTitle>
                <CardDescription>
                    Highest performing items this month.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {/* We pass the data from the stats API directly here */}
                <TopProducts data={stats?.top_products || []} />
            </CardContent>
        </Card>
      </div>
    </div>
  );
}