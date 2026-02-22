'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api'; 
import api from '@/lib/api';
import { SystemTenant } from '@/lib/types';
import Link from 'next/link';

// UI Components
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

// Icons
import { 
  Loader2, Search, Building2, ChevronLeft, ChevronRight, 
  DollarSign, Ticket, TrendingUp, Activity, BrainCircuit, Play, CheckCircle2
} from 'lucide-react';

// Charts
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { toast } from 'sonner';

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
  // --- STATE: ANALYTICS ---
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(true);

  // --- STATE: TENANT LIST ---
  const [tenants, setTenants] = useState<SystemTenant[]>([]);
  const [isListLoading, setIsListLoading] = useState(true);
  
  // Search & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 500);
  const [nextPage, setNextPage] = useState<string | null>(null);
  const [prevPage, setPrevPage] = useState<string | null>(null);

  // --- STATE: AI TRAINING ---
  const [isTraining, setIsTraining] = useState(false);
  const [lastTrained, setLastTrained] = useState<string | null>(null);

  // --- 1. FETCH ANALYTICS (Once) ---
  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        const stats = await adminApi.getSystemAnalytics();
        setAnalytics(stats);
      } catch (error) {
        console.error("Analytics Error", error);
        toast.error("Failed to load global stats");
      } finally {
        setIsAnalyticsLoading(false);
      }
    };
    loadAnalytics();
  }, []);

  // --- 2. FETCH TENANTS (Searchable & Paginated) ---
  const fetchTenants = useCallback(async (url: string = '/api/admin/tenants/') => {
    setIsListLoading(true);
    try {
      let finalUrl = url;
      if (url.includes('/api/admin/tenants/') && debouncedSearch) {
        const separator = finalUrl.includes('?') ? '&' : '?';
        finalUrl += `${separator}search=${encodeURIComponent(debouncedSearch)}`;
      }

      const { data } = await api.get(finalUrl);

      if (data.results) {
        setTenants(data.results);
        setNextPage(data.next);
        setPrevPage(data.previous);
      } else if (Array.isArray(data)) {
        setTenants(data);
        setNextPage(null);
        setPrevPage(null);
      }
    } catch (error) {
      console.error("Tenant Fetch Error", error);
      toast.error("Failed to load tenant list");
    } finally {
      setIsListLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    fetchTenants('/api/admin/tenants/');
  }, [fetchTenants]); 

  const handleNext = () => { if (nextPage) fetchTenants(nextPage); };
  const handlePrev = () => { if (prevPage) fetchTenants(prevPage); };

  // --- 3. HANDLE AI TRAINING TRIGGER ---
  const handleTriggerTraining = async () => {
      setIsTraining(true);
      try {
          // Calls the endpoint to train models -> TrainModelsView
          await api.post('/api/admin/train-models/');
          
          toast.success("Training Initiated", {
              description: "The ML engine is now reprocessing sales data."
          });
          setLastTrained(new Date().toLocaleTimeString());
      } catch (error) {
          console.error(error);
          toast.error("Training Failed", { description: "Could not contact the ML service." });
      } finally {
          setIsTraining(false);
      }
  };

  if (isAnalyticsLoading && isListLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  // Helper to determine color based on status
  const getHealthColor = (status: string) => status === 'Online' ? 'bg-green-500' : 'bg-red-500';
  const getHealthText = (status: string) => status === 'Online' ? 'text-green-600' : 'text-red-600';
  const isPositiveGrowth = (analytics?.growth_rate || 0) >= 0;

  return (
    <div className="space-y-8">
      
      {/* ---------------- SECTION 1: GLOBAL ANALYTICS ---------------- */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">System Overview</h2>
        <p className="text-slate-500">Global performance across all organizations.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₦{analytics?.global_revenue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Lifetime platform volume</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Tenants</CardTitle>
            <Activity className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics?.active_tenants} <span className="text-sm text-slate-400 font-normal">/ {analytics?.total_tenants}</span>
            </div>
            <p className="text-xs text-muted-foreground">Stores currently online</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Support Load</CardTitle>
            <Ticket className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.open_tickets}</div>
            <p className="text-xs text-muted-foreground">Active tickets pending</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Growth Rate</CardTitle>
            <TrendingUp className={`h-4 w-4 ${isPositiveGrowth ? 'text-green-600' : 'text-red-600'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${isPositiveGrowth ? 'text-green-600' : 'text-red-600'}`}>
              {isPositiveGrowth ? '+' : ''}{analytics?.growth_rate}%
            </div>
            <p className="text-xs text-muted-foreground">vs. last month</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-7">
        {/* Revenue Graph */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics?.graph_data}>
                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₦${value}`} />
                <Tooltip 
                    contentStyle={{ background: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
                    cursor={{fill: 'transparent'}}
                />
                <Bar dataKey="total" fill="#0f172a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* System Health */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>System Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              
              {/* DATABASE */}
              <div className="flex items-center">
                <span className="relative flex h-2 w-2 mr-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${analytics?.health.database === 'Online' ? 'bg-green-400' : 'bg-red-400'}`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${getHealthColor(analytics?.health.database || 'Offline')}`}></span>
                </span>
                <div className="ml-4 space-y-1">
                  <p className="text-sm font-medium leading-none">Database</p>
                  <p className="text-sm text-muted-foreground">PostgreSQL</p>
                </div>
                <div className={`ml-auto font-medium ${getHealthText(analytics?.health.database || 'Offline')}`}>
                  {analytics?.health.database}
                </div>
              </div>
              
              {/* REDIS */}
              <div className="flex items-center">
                <span className={`flex h-2 w-2 rounded-full mr-2 ${getHealthColor(analytics?.health.redis || 'Offline')}`}></span>
                <div className="ml-4 space-y-1">
                  <p className="text-sm font-medium leading-none">Task Queue</p>
                  <p className="text-sm text-muted-foreground">Redis / Celery</p>
                </div>
                <div className={`ml-auto font-medium ${getHealthText(analytics?.health.redis || 'Offline')}`}>
                  {analytics?.health.redis}
                </div>
              </div>

              {/* API */}
              <div className="flex items-center">
                <span className={`flex h-2 w-2 rounded-full mr-2 ${getHealthColor(analytics?.health.api || 'Offline')}`}></span>
                <div className="ml-4 space-y-1">
                  <p className="text-sm font-medium leading-none">API Gateway</p>
                  <p className="text-sm text-muted-foreground">Django REST</p>
                </div>
                <div className={`ml-auto font-medium ${getHealthText(analytics?.health.api || 'Offline')}`}>
                  {analytics?.health.api}
                </div>
              </div>

            </div>
          </CardContent>
        </Card>
      </div>

      {/* ---------------- SECTION 1.5: SYSTEM OPERATIONS (NEW) ---------------- */}
      <div className="grid gap-4 md:grid-cols-1">
          <Card className="border-l-4 border-l-purple-500 bg-slate-50/50">
              <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                      <div className="space-y-1">
                          <CardTitle className="text-base flex items-center gap-2">
                              <BrainCircuit className="h-5 w-5 text-purple-600" />
                              AI Model Operations
                          </CardTitle>
                          <CardDescription>
                              Manually trigger retraining for Demand Forecasting models across all tenants.
                          </CardDescription>
                      </div>
                      <div className="flex items-center gap-4">
                           {lastTrained && (
                                <span className="text-xs text-muted-foreground flex items-center bg-white px-2 py-1 rounded border">
                                    <CheckCircle2 className="h-3 w-3 text-green-500 mr-1" />
                                    Last run: {lastTrained}
                                </span>
                           )}
                           <Button 
                                onClick={handleTriggerTraining} 
                                disabled={isTraining}
                                className="bg-purple-600 hover:bg-purple-700 text-white"
                            >
                                {isTraining ? (
                                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Training...</>
                                ) : (
                                    <><Play className="mr-2 h-4 w-4" /> Start Training</>
                                )}
                            </Button>
                      </div>
                  </div>
              </CardHeader>
          </Card>
      </div>

      {/* ---------------- SECTION 2: TENANT MANAGEMENT ---------------- */}
      <div className="pt-4">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mb-4">Organizations Directory</h2>
        
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Manage Tenants</CardTitle>
              <div className="relative w-72">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search organizations..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isListLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>URL Slug</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Joined Date</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tenants.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No organizations found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      tenants.map((tenant) => (
                        <TableRow key={tenant.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-md">
                                <Building2 className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                              </div>
                              {tenant.name}
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-500">{tenant.slug}</TableCell>
                          <TableCell>
                            {tenant.is_active ? (
                              <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200 border">
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="destructive">Inactive</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {new Date(tenant.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" asChild>
                               <Link href={`/system-admin/tenants/${tenant.id}`}>
                                  View Data
                               </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>

                {/* Pagination */}
                <div className="flex items-center justify-end space-x-2 py-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrev}
                    disabled={!prevPage || isListLoading}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNext}
                    disabled={!nextPage || isListLoading}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}