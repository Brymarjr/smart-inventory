"use client";

import { useEffect, useState, useCallback } from "react";
import { adminApi } from "@/lib/api";
import api from "@/lib/api";
import { SystemTenant } from "@/lib/types";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

// UI Components
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

// Icons
import {
  Loader2,
  Search,
  Building2,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Ticket,
  TrendingUp,
  Activity,
  BrainCircuit,
  Play,
  CheckCircle2,
  BarChart3,
} from "lucide-react";

// Charts
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { toast } from "sonner";

// --- HELPER HOOKS ---
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// --- TYPES ---
interface AnalyticsData {
  total_tenants: number;
  active_tenants: number;
  global_revenue: number;
  open_tickets: number;
  growth_rate: number;
  health: {
    database: string;
    redis: string;
    api: string;
  };
  graph_data: { name: string; total: number }[];
}

export default function SystemAdminDashboard() {
  const { logout } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(true);
  const [tenants, setTenants] = useState<SystemTenant[]>([]);
  const [isListLoading, setIsListLoading] = useState(true);

  // Search & Pagination
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 500);
  const [nextPage, setNextPage] = useState<string | null>(null);
  const [prevPage, setPrevPage] = useState<string | null>(null);

  // AI Training
  const [isTraining, setIsTraining] = useState(false);
  const [lastTrained, setLastTrained] = useState<string | null>(null);

  // 1. Fetch Analytics
  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        const stats = await adminApi.getSystemAnalytics();
        setAnalytics(stats);
      } catch (error) {
        toast.error("Failed to load global stats");
      } finally {
        setIsAnalyticsLoading(false);
      }
    };
    loadAnalytics();
  }, []);

  // 2. Fetch Tenants
  const fetchTenants = useCallback(
    async (url: string = "/api/admin/tenants/") => {
      setIsListLoading(true);
      try {
        let finalUrl = url;
        if (debouncedSearch) {
          const separator = finalUrl.includes("?") ? "&" : "?";
          finalUrl += `${separator}search=${encodeURIComponent(debouncedSearch)}`;
        }
        const { data } = await api.get(finalUrl);
        if (data.results) {
          setTenants(data.results);
          setNextPage(data.next);
          setPrevPage(data.previous);
        } else {
          setTenants(data);
        }
      } catch (error) {
        toast.error("Failed to load tenant list");
      } finally {
        setIsListLoading(false);
      }
    },
    [debouncedSearch],
  );

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  // 3. Handle Training
  const handleTriggerTraining = async () => {
    setIsTraining(true);
    try {
      await api.post("/api/admin/train-models/");
      toast.success("Platform-wide training started");
      setLastTrained(new Date().toLocaleTimeString());
    } catch (error) {
      toast.error("Training trigger failed");
    } finally {
      setIsTraining(false);
    }
  };

  if (isAnalyticsLoading && isListLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6">
      {/* Header Area */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">System Overview</h2>
          <p className="text-muted-foreground">Global organizational performance.</p>
        </div>
        <div className="flex gap-4">
          <Button variant="default" asChild className="bg-blue-600 hover:bg-blue-700">
            <Link href="/system-admin/analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Platform Intelligence
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Global Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₦{analytics?.global_revenue.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Stores</CardTitle>
            <Activity className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.active_tenants} / {analytics?.total_tenants}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Support Tickets</CardTitle>
            <Ticket className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.open_tickets}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Growth</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">+{analytics?.growth_rate}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Stats Area */}
      <div className="grid gap-4 md:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader><CardTitle>Revenue Trend</CardTitle></CardHeader>
          <CardContent className="pl-2 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics?.graph_data}>
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `₦${v}`} />
                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '8px'}} />
                <Bar dataKey="total" fill="#1e293b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader><CardTitle>Platform Health</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Database (PostgreSQL)</span>
              <Badge className="bg-green-500">{analytics?.health.database}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Task Queue (Redis)</span>
              <Badge className="bg-green-500">{analytics?.health.redis}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">API Layer (Django)</span>
              <Badge className="bg-green-500">{analytics?.health.api}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Management Section */}
      <Card className="border-purple-200 bg-purple-50/50">
        <CardContent className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-full text-purple-600">
              <BrainCircuit className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold">AI Forecasting Operations</h3>
              <p className="text-sm text-muted-foreground">Trigger model retraining for all tenants.</p>
              {lastTrained && <p className="text-[10px] mt-1 text-purple-600 font-semibold">Last update: {lastTrained}</p>}
            </div>
          </div>
          <Button onClick={handleTriggerTraining} disabled={isTraining} className="bg-purple-600 hover:bg-purple-700">
            {isTraining ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
            {isTraining ? "Processing..." : "Start Platform Sync"}
          </Button>
        </CardContent>
      </Card>

      {/* Tenant Directory */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Organizations Directory</CardTitle>
          <div className="relative w-72">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search organizations..." 
              className="pl-8" 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Store Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isListLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></TableCell></TableRow>
              ) : tenants.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-slate-400" /> {t.name}
                  </TableCell>
                  <TableCell className="text-xs">{t.slug}</TableCell>
                  <TableCell>{t.is_active ? <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Active</Badge> : <Badge variant="destructive">Inactive</Badge>}</TableCell>
                  <TableCell className="text-xs">{new Date(t.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/system-admin/tenants/${t.id}`}>Manage</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}