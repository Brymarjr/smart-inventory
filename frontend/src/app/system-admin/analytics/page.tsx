"use client";

import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  RefreshCw,
  Users,
  TrendingUp,
  AlertOctagon,
  FileSpreadsheet,
  BrainCircuit,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function SystemAdminAnalytics() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isTraining, setIsTraining] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/admin/platform-stats/");
      setData(res.data);
    } catch (err) {
      toast.error("Failed to load platform intelligence.");
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = async () => {
    try {
      const response = await api.get("/api/admin/global-report/", {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `platform_report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("CSV Report downloaded successfully");
    } catch (err) {
      toast.error("Export failed");
    }
  };

  const triggerGlobalTraining = async () => {
    setIsTraining(true);
    try {
      await api.post("/api/admin/train-models/");
      toast.success("Global AI Training initiated for all tenants.");
    } catch (err) {
      toast.error("Failed to start global training.");
    } finally {
      setIsTraining(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  const breakdown = data?.monthly_breakdown || [];
  const totalRevenue = breakdown.reduce((acc: number, curr: any) => acc + curr.revenue, 0);
  const totalProfit = breakdown.reduce((acc: number, curr: any) => acc + curr.profit, 0);
  const totalAlerts = breakdown.reduce((acc: number, curr: any) => acc + curr.alerts, 0);

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto pb-20">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">Platform Intelligence</h1>
          <p className="text-muted-foreground">Monitoring growth and health across {data?.total_tenants} tenants.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={downloadCSV}>
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Export CSV
          </Button>
          <Button onClick={triggerGlobalTraining} disabled={isTraining}>
            {isTraining ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <BrainCircuit className="mr-2 h-4 w-4" />}
            Sync Global AI
          </Button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Total Tenants" value={data?.total_tenants} icon={Users} color="text-blue-500" />
        <StatCard title="Total Revenue" value={`₦${totalRevenue.toLocaleString()}`} icon={TrendingUp} color="text-green-500" />
        <StatCard title="Net Profit" value={`₦${totalProfit.toLocaleString()}`} icon={TrendingUp} color="text-emerald-600" />
        <StatCard title="Global Anomalies" value={totalAlerts} icon={AlertOctagon} color="text-red-500" />
      </div>

      {/* CHARTS */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Business Performance</CardTitle>
            <CardDescription>Revenue vs Profit comparison</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={breakdown}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(val) => `₦${val / 1000}k`} />
                <Tooltip 
                  formatter={(value: any) => [`₦${Number(value).toLocaleString()}`, "Amount"]}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} 
                />
                <Legend />
                <Bar dataKey="revenue" fill="#3b82f6" name="Revenue" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" fill="#10b981" name="Profit" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alert Distribution</CardTitle>
            <CardDescription>Risk profile per business</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={breakdown}
                  dataKey="alerts"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                >
                  {breakdown.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => [value, "Active Anomalies"]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* TENANT PERFORMANCE TABLE */}
      <Card>
        <CardHeader>
          <CardTitle>Tenant Health List</CardTitle>
          <CardDescription>Detailed metrics for individual businesses</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business Name</TableHead>
                <TableHead>Monthly Revenue</TableHead>
                <TableHead>Monthly Profit</TableHead>
                <TableHead>Margin</TableHead>
                <TableHead>Alerts</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {breakdown.map((tenant: any, idx: number) => {
                const margin = ((tenant.profit / tenant.revenue) * 100).toFixed(1);
                return (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{tenant.name}</TableCell>
                    <TableCell>₦{tenant.revenue.toLocaleString()}</TableCell>
                    <TableCell className="text-emerald-600 font-semibold">₦{tenant.profit.toLocaleString()}</TableCell>
                    <TableCell>
                       <Badge variant={Number(margin) > 20 ? "secondary" : "outline"}>
                         {margin}%
                       </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={tenant.alerts > 5 ? "destructive" : "default"}>
                        {tenant.alerts} issues
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                       <Button variant="ghost" size="sm">
                         View Details <ExternalLink className="ml-2 h-3 w-3" />
                       </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: any) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}