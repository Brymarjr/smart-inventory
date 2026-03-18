"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api"; 
import {
  forecastService,
  DashboardData,
  AnomalyAlert,
} from "@/services/forecastService";
import {
  TrendingUp,
  AlertTriangle,
  PackageX,
  Activity,
  Loader2,
  RefreshCw,
  Info,
  FilterX,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  X,
  ExternalLink,
  Lock,
  Search,
  ChevronLeft,
  ChevronRight,
  LineChart,
  Eye,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as ReChartsTooltip 
} from "recharts";
import { toast } from "sonner";

// --- TYPES ---
type FilterType = "all" | "critical" | "ghost_stock" | "velocity_spike";

export default function AnalyticsPage() {
  const router = useRouter();
  
  // Data States
  const [data, setData] = useState<DashboardData | null>(null);
  const [forecasts, setForecasts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Pagination & Search States
  const [searchQuery, setSearchQuery] = useState("");
  const [nextPage, setNextPage] = useState<string | null>(null);
  const [prevPage, setPrevPage] = useState<string | null>(null);

  // UI States
  const [isLocked, setIsLocked] = useState(false);
  const [lockMessage, setLockMessage] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [selectedAlert, setSelectedAlert] = useState<AnomalyAlert | null>(null);
  const [selectedProductChart, setSelectedProductChart] = useState<{name: string, data: any[]} | null>(null);

  // 1. Load Dashboard (Summary & Alerts)
  const loadSummary = async () => {
    try {
      const result = await forecastService.getDashboard();
      if ("isLocked" in result && result.isLocked) {
        setIsLocked(true);
        setLockMessage(result.message);
        return; 
      }
      setData(result as DashboardData);
    } catch (err) {
      console.error(err);
      setError("Failed to connect to Intelligence Engine.");
    }
  };

  // 2. Load Forecasts (Paginated Table)
  const loadForecasts = useCallback(async (url: string = "/api/forecasts/", search: string = "") => {
    setLoading(true);
    try {
      let finalUrl = url;
      if (search) {
        const connector = finalUrl.includes("?") ? "&" : "?";
        finalUrl += `${connector}search=${encodeURIComponent(search)}`;
      }
      const { data } = await api.get(finalUrl);
      setForecasts(data.results || []);
      setNextPage(data.next);
      setPrevPage(data.previous);
    } catch (err) {
      console.error("Forecast load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
    loadForecasts();
  }, [loadForecasts]);

  // Handle Search Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      loadForecasts("/api/forecasts/", searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, loadForecasts]);

  // 3. Fetch 7-Day Trend for specific product
  const fetchProductTrend = async (productId: any, productName: string) => {
    if (!productId) {
        toast.error("Product identity missing");
        return;
    }
    
    try {
      const { data } = await api.get(`/api/forecasts/product_chart/?product_id=${productId}`);
      setSelectedProductChart({ name: productName, data: data.timeline });
    } catch (err) {
      toast.error("Failed to load trend data");
    }
  };

  // Filter Logic
  const getFilteredAlerts = () => {
    if (!data || !data.alerts) return [];
    if (activeFilter === "all") return data.alerts;

    return data.alerts.filter((alert) => {
      if (activeFilter === "critical") return alert.severity === "high";
      if (activeFilter === "ghost_stock") return alert.anomaly_type === "shrinkage";
      if (activeFilter === "velocity_spike") return alert.anomaly_type === "velocity_spike";
      return true;
    });
  };

  const getFilterTitle = () => {
    switch (activeFilter) {
      case "critical": return "Critical Risks";
      case "ghost_stock": return "Ghost Stock (Suspected Theft)";
      case "velocity_spike": return "Velocity Spikes";
      default: return "All Anomalies";
    }
  };

  if (loading && !data && !isLocked) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading Intelligence...</span>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-center max-w-md mx-auto animate-in fade-in duration-500">
        <div className="bg-primary/10 p-6 rounded-full mb-6"><Lock className="w-12 h-12 text-primary" /></div>
        <h2 className="text-3xl font-bold text-foreground mb-3">Enterprise Intelligence</h2>
        <p className="text-muted-foreground mb-8">{lockMessage || "Upgrade for AI insights."}</p>
        <Link href="/dashboard/billing" className="w-full"><Button size="lg" className="w-full rounded-xl">Upgrade Now</Button></Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>
        <Button onClick={() => { loadSummary(); loadForecasts(); }} variant="outline" className="mt-4">Retry</Button>
      </div>
    );
  }

  if (!data) return null;

  const summary = data.summary || { total_alerts: 0, critical_alerts: 0, ghost_stock: 0, velocity_spikes: 0 };
  const filteredAlerts = getFilteredAlerts();

  return (
    <div className="space-y-6 p-6 relative">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Intelligence Center</h1>
          <p className="text-muted-foreground">{activeFilter === "all" ? "System overview and AI predictions." : `Showing ${getFilterTitle()}.`}</p>
        </div>
        <div className="flex gap-2">
          {activeFilter !== "all" && (
            <Button variant="ghost" size="sm" onClick={() => setActiveFilter("all")}><FilterX className="mr-2 h-4 w-4" /> Clear Filter</Button>
          )}
          <Button onClick={() => { loadSummary(); loadForecasts(); }} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatWidget title="Total Anomalies" value={summary.total_alerts} icon={AlertTriangle} isActive={activeFilter === "all"} onClick={() => setActiveFilter("all")} className={summary.total_alerts > 0 ? "border-red-200 bg-red-50/50" : ""} />
        <StatWidget title="Critical Risks" value={summary.critical_alerts} icon={Activity} isActive={activeFilter === "critical"} onClick={() => setActiveFilter("critical")} className={summary.critical_alerts > 0 ? "border-red-400 bg-red-100" : ""} />
        <StatWidget title="Ghost Stock" value={summary.ghost_stock} icon={PackageX} isActive={activeFilter === "ghost_stock"} onClick={() => setActiveFilter("ghost_stock")} />
        <StatWidget title="Velocity Spikes" value={summary.velocity_spikes} icon={TrendingUp} isActive={activeFilter === "velocity_spike"} onClick={() => setActiveFilter("velocity_spike")} />
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
        {/* ANOMALY FEED */}
        <Card className={`lg:col-span-1 border-l-4 ${activeFilter === 'ghost_stock' ? 'border-l-purple-500' : activeFilter === 'velocity_spike' ? 'border-l-blue-500' : activeFilter === 'critical' ? 'border-l-red-500' : 'border-l-yellow-400'}`}>
          <CardHeader><CardTitle className="flex justify-between items-center text-lg"><span>Anomaly Feed</span><Badge variant="outline">{filteredAlerts.length}</Badge></CardTitle></CardHeader>
          <CardContent className="grid gap-4 max-h-[600px] overflow-y-auto">
            {filteredAlerts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground"><TrendingUp size={24} className="mx-auto mb-2 opacity-20" /> Healthy</div>
            ) : filteredAlerts.map((alert) => (
              <div key={alert.id} onClick={() => setSelectedAlert(alert)} className="group border p-3 rounded-lg cursor-pointer hover:border-blue-300 bg-card shadow-sm transition-all">
                <div className="flex justify-between font-semibold text-sm"><span>{alert.product_name}</span><Badge variant={alert.severity === "high" ? "destructive" : "outline"}>{alert.anomaly_type === "shrinkage" ? "Ghost Stock" : alert.anomaly_type.replace("_", " ")}</Badge></div>
                <div className="bg-muted p-2 rounded mt-2 text-xs text-slate-700">{alert.description}</div>
                <div className="flex justify-between items-center mt-2 text-[10px] text-muted-foreground font-medium"><span>{new Date(alert.detected_at).toLocaleDateString()}</span><span className="text-blue-600 opacity-0 group-hover:opacity-100">Investigate <ArrowRight className="inline h-3 w-3" /></span></div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* FORECAST TABLE */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div><CardTitle>AI Demand Forecasts</CardTitle><CardDescription>Monitor stock levels and predicted demand.</CardDescription></div>
              <div className="relative w-full md:w-64"><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search product..." className="pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Predicted</TableHead>
                  <TableHead className="hidden md:table-cell">Reasoning</TableHead>
                  <TableHead className="text-right">Trend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                ) : forecasts.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8">No forecasts found.</TableCell></TableRow>
                ) : forecasts.map((item, idx) => (
                  <TableRow key={idx} className="group hover:bg-muted/50 transition-colors">
                    <TableCell>
                      <div className="font-medium">{item.product_name}</div>
                      <div className="text-xs text-muted-foreground">{item.product_sku}</div>
                    </TableCell>
                    <TableCell>{item.current_stock}</TableCell>
                    <TableCell className="font-bold text-blue-600">{Number(item.predicted_quantity).toFixed(1)}</TableCell>
                    <TableCell className="hidden md:table-cell"><Badge variant="secondary" className="font-normal">{item.reasoning}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-blue-600"
                        onClick={() => fetchProductTrend(item.product, item.product_name)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-muted-foreground">Showing AI-generated projections</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={!prevPage} onClick={() => loadForecasts(prevPage!)}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="sm" disabled={!nextPage} onClick={() => loadForecasts(nextPage!)}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 7-DAY TREND MODAL */}
      {selectedProductChart && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-3xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle className="flex items-center gap-2"><LineChart className="h-5 w-5 text-blue-500" /> {selectedProductChart.name}</CardTitle><CardDescription>Predicted sales volume over the next 7 days</CardDescription></div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedProductChart(null)}><X /></Button>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={selectedProductChart.data}>
                    <defs><linearGradient id="colorQty" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="prediction_date" tickFormatter={(str) => new Date(str).toLocaleDateString(undefined, {weekday: 'short'})} /><YAxis /><ReChartsTooltip labelClassName="text-slate-900" />
                    <Area type="monotone" dataKey="predicted_quantity" stroke="#3b82f6" fillOpacity={1} fill="url(#colorQty)" name="Predicted Units" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 mt-6">
                {selectedProductChart.data.map((day: any, i: number) => (
                  <div key={i} className="border rounded-md p-2 text-center bg-muted/30">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">{new Date(day.prediction_date).toLocaleDateString(undefined, {weekday: 'short'})}</p>
                    <p className="text-lg font-black">{Number(day.predicted_quantity).toFixed(0)}</p>
                    <p className="text-[8px] text-blue-600 italic leading-tight">{day.reasoning}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* INVESTIGATION MODAL */}
      {selectedAlert && <InvestigationModal alert={selectedAlert} onClose={() => setSelectedAlert(null)} router={router} />}
    </div>
  );
}

// --- SUB-COMPONENTS ---
function StatWidget({ title, value, icon: Icon, className, tooltip, onClick, isActive }: any) {
  return (
    <Card onClick={onClick} className={`${className} relative cursor-pointer transition-all hover:shadow-md active:scale-95 ${isActive ? "ring-2 ring-primary border-primary shadow-md" : "border-transparent hover:border-gray-300"}`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">{title}{tooltip && <div className="group/info relative z-50"><Info className="h-3 w-3 text-muted-foreground" /><div className="absolute hidden group-hover/info:block bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-900 text-white text-[10px] rounded shadow-lg">{tooltip}</div></div>}</CardTitle>
        <Icon className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
      </CardHeader>
      <CardContent><div className="text-2xl font-bold">{value ?? 0}</div></CardContent>
    </Card>
  );
}

function InvestigationModal({ alert, onClose, router }: any) {
  const getSteps = () => {
    if (alert.anomaly_type === "shrinkage") return ["Physical count.", "Check returns.", "Adjust stock to match reality.", "Review security footage."];
    return ["Verify history.", "Check for data entry errors.", "Confirm with cashier."];
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card rounded-lg shadow-xl w-full max-w-lg overflow-hidden border">
        <div className={`p-4 border-b flex justify-between items-center font-bold ${alert.anomaly_type === 'shrinkage' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}><h2>Resolve: {alert.product_name}</h2><X className="h-5 w-5 cursor-pointer" onClick={onClose} /></div>
        <div className="p-6 space-y-4">
          <div className="bg-muted p-3 rounded-md text-sm border">{alert.description}</div>
          <div className="space-y-2"><p className="text-xs font-bold uppercase text-muted-foreground">Action Steps:</p>{getSteps().map((s, i) => <div key={i} className="flex gap-2 text-sm"><span>{i+1}.</span> {s}</div>)}</div>
        </div>
        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Dismiss</Button>
          <Button onClick={() => { router.push(alert.anomaly_type === 'shrinkage' ? '/dashboard/inventory' : '/dashboard/sales/history'); onClose(); }}>Action Center</Button>
        </div>
      </div>
    </div>
  );
}