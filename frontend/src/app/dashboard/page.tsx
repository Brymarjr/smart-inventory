"use client";

import { useQuery } from "@tanstack/react-query";
import { salesService } from "@/services/salesService";
import { StatCard } from "@/components/dashboard/stat-card";
import { RecentSales } from "@/components/dashboard/recent-sales"; // ✅ Import
import { TopProducts } from "@/components/dashboard/top-products"; // ✅ Import
import {
  DollarSign,
  TrendingUp,
  Package,
  AlertTriangle,
  ArrowUpRight,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: salesService.getDashboardStats,
  });

  if (isLoading) {
    return <div className="flex h-[50vh] items-center justify-center"></div>;
  }

  const formatMoney = (amount: number) => {
    return `₦${amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? "0.00"}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of Business.</p>
      </div>

      {/* 4 Main Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Revenue"
          value={formatMoney(stats?.revenue?.value || 0)}
          icon={DollarSign}
          trend={stats?.revenue?.trend}
        />
        <StatCard
          title="Total Profit"
          value={
            stats?.profit?.value !== undefined
              ? formatMoney(stats.profit.value)
              : " 🔒 Pro Feature"
          }
          icon={TrendingUp}
          trend={stats?.profit?.trend}
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
          <CardHeader className="grid grid-cols-[1fr_auto] items-center gap-y-1.5 bg-slate-50/50 border-b border-slate-100 p-6">
            <CardTitle className="col-start-1 row-start-1 text-lg font-bold text-[#1A1B4B]">
              Recent Sales
            </CardTitle>
            <CardDescription className="col-start-1 row-start-2 text-sm font-medium text-slate-500">
              Latest transactions from your store
            </CardDescription>
            <div className="col-start-2 row-span-2 row-start-1 flex items-center justify-center p-2 bg-card rounded-lg border border-slate-200 shadow-sm">
              <ArrowUpRight className="h-4 w-4 text-[#2D31FA]" />
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <RecentSales />
          </CardContent>
        </Card>

        {/* Top Products Widget */}
        <Card className="col-span-3">
          <CardHeader className="grid grid-cols-[1fr_auto] items-center gap-y-1.5 bg-slate-50/50 border-b border-slate-100 p-6">
            <CardTitle className="col-start-1 row-start-1 text-lg font-bold text-[#1A1B4B]">
              Top Selling Products
            </CardTitle>
            <CardDescription className="col-start-1 row-start-2 text-sm font-medium text-slate-500">
              Highest performing items this month.
            </CardDescription>
            <div className="col-start-2 row-span-2 row-start-1 flex items-center justify-center p-2 bg-card rounded-lg border border-slate-200 shadow-sm">
              <TrendingUp className="h-4 w-4 text-[#2D31FA]" />
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {/* We pass the data from the stats API directly here */}
            <TopProducts data={stats?.top_products || []} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
