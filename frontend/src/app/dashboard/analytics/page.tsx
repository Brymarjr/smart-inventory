"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import {
  forecastService,
  DashboardData,
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
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Search,
  LineChart,
  Ghost,
  Zap
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
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as ReChartsTooltip 
} from "recharts";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DebouncedInput } from "@/components/shared/debounced-input";
import { toast } from "sonner";

// --- TYPES ---
type FilterType = "all" | "critical" | "ghost_stock" | "velocity_spike";

interface ExtendedAnomalyAlert {
  id: number;
  product_name: string;
  product_sku: string;
  product_id?: number;
  anomaly_type: "shrinkage" | "velocity_spike" | "stockout_risk";
  severity: "low" | "medium" | "high";
  description: string;
  detected_at: string;
}

export default function AnalyticsPage() {
  const router = useRouter();
  
  const [data, setData] = useState<DashboardData | null>(null);
  const [forecasts, setForecasts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [isLocked, setIsLocked] = useState(false);
  const [lockMessage, setLockMessage] = useState("");

  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [selectedAlert, setSelectedAlert] = useState<ExtendedAnomalyAlert | null>(null);

  const [forecastPage, setForecastPage] = useState(1);
  const [forecastTotal, setForecastTotal] = useState(0);
  const [forecastSearch, setForecastSearch] = useState(""); 
  const [isForecastsLoading, setIsForecastsLoading] = useState(false);

  // ✅ Central Modal State
  const [selectedProductChart, setSelectedProductChart] = useState<{name: string, data: any[]} | null>(null);
  const [isChartLoading, setIsChartLoading] = useState(false);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const result = await forecastService.getDashboard();
      if ("isLocked" in result && result.isLocked) {
        setIsLocked(true);
        setLockMessage(result.message);
        return; 
      }
      setData(result as DashboardData);
    } catch (err) {
      setError("Failed to connect to Intelligence Engine.");
    } finally {
      setLoading(false);
    }
  };

  const loadForecasts = async (page: number, search: string = forecastSearch) => {
    setIsForecastsLoading(true);
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateString = tomorrow.toISOString().split('T')[0];

      const res = await api.get(`/api/forecasts/?page=${page}&prediction_date=${dateString}&search=${search}`);
      setForecasts(res.data.results);
      setForecastTotal(res.data.count);
      setForecastPage(page);
    } catch (err) {
      console.error("Failed to load forecasts", err);
    } finally {
      setIsForecastsLoading(false);
    }
  };

  const fetchProductTrend = async (productId: number, productName: string) => {
    setIsChartLoading(true);
    try {
      const { data } = await api.get(`/api/forecasts/product_chart/?product_id=${productId}`);
      setSelectedProductChart({ name: productName, data: data.timeline });
    } catch (err) {
      toast.error("Failed to load trend data");
    } finally {
      setIsChartLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    loadForecasts(1, "");
  }, []);

  useEffect(() => {
    if (!loading) { 
        loadForecasts(1, forecastSearch);
    }
  }, [forecastSearch]);

  const getFilteredAlerts = () => {
    if (!data || !data.alerts) return [];
    const alerts = data.alerts as unknown as ExtendedAnomalyAlert[];
    if (activeFilter === "all") return alerts;
    return alerts.filter((alert) => {
      if (activeFilter === "critical") return alert.anomaly_type === "stockout_risk" || alert.severity === "high";
      if (activeFilter === "ghost_stock") return alert.anomaly_type === "shrinkage";
      if (activeFilter === "velocity_spike") return alert.anomaly_type === "velocity_spike";
      return true;
    });
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
        <div className="bg-primary/10 p-6 rounded-full mb-6">
          <Lock className="w-12 h-12 text-primary" />
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-3">Enterprise Intelligence</h2>
        <p className="text-muted-foreground mb-8 leading-relaxed">
          {lockMessage || "Unlock AI-driven demand forecasting, anomaly detection, and advanced inventory insights by upgrading your plan."}
        </p>
        <Link href="/dashboard/billing">
          <Button size="lg" className="w-full font-bold text-md h-12 rounded-xl">
            Upgrade to Enterprise
          </Button>
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Connection Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={() => { loadDashboard(); loadForecasts(1); }} variant="outline" className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  const summary = data?.summary || { total_alerts: 0, critical_alerts: 0, ghost_stock: 0, velocity_spikes: 0 };
  const filteredAlerts = getFilteredAlerts();

  return (
    <div className="space-y-6 p-6 relative">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Intelligence Center</h1>
          <p className="text-muted-foreground">AI-driven anomaly detection and procurement routing.</p>
        </div>
        <div className="flex gap-2">
          {activeFilter !== "all" && (
            <Button variant="ghost" size="sm" onClick={() => setActiveFilter("all")}>
              <FilterX className="mr-2 h-4 w-4" /> Reset Filters
            </Button>
          )}
          <Button
            onClick={() => { loadDashboard(); loadForecasts(1); }}
            variant="outline"
            size="sm"
            disabled={loading || isForecastsLoading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading || isForecastsLoading ? "animate-spin" : ""}`} /> Sync Data
          </Button>
        </div>
      </div>

      <TooltipProvider>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatWidget 
            title="Total Anomalies" value={summary.total_alerts} icon={AlertTriangle} 
            isActive={activeFilter === "all"} onClick={() => setActiveFilter("all")} 
            className={summary.total_alerts > 0 ? "border-red-200 bg-red-50/50" : ""}
            tooltip="Total number of irregularities detected across your entire stock catalog."
        />
        <StatWidget 
            title="Critical Risks" value={summary.critical_alerts} icon={Activity} 
            isActive={activeFilter === "critical"} onClick={() => setActiveFilter("critical")} 
            className={summary.critical_alerts > 0 ? "border-red-400 bg-red-100" : ""} 
            tooltip="Products at high risk of stockout within 14 days based on current velocity."
        />
        <StatWidget 
            title="Ghost Stock" value={summary.ghost_stock} icon={Ghost} 
            isActive={activeFilter === "ghost_stock"} onClick={() => setActiveFilter("ghost_stock")} 
            tooltip="Products with positive stock levels but zero recorded sales for over 7 days."
        />
        <StatWidget 
            title="Velocity Spikes" value={summary.velocity_spikes} icon={TrendingUp} 
            isActive={activeFilter === "velocity_spike"} onClick={() => setActiveFilter("velocity_spike")} 
            tooltip="Sudden surges in demand that deviate significantly from the baseline average."
        />
      </div>
      </TooltipProvider>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
        {/* --- ANOMALY FEED --- */}
        <Card className={`lg:col-span-1 border-l-4 transition-all ${
            activeFilter === 'ghost_stock' ? 'border-l-purple-500' : 
            activeFilter === 'velocity_spike' ? 'border-l-blue-500' : 
            activeFilter === 'critical' ? 'border-l-red-500' : 'border-l-yellow-400'
        }`}>
          <CardHeader>
            <CardTitle className="flex items-center text-lg justify-between">
              <span className="flex items-center">
                <AlertTriangle className="mr-2 h-5 w-5 text-muted-foreground" />
                Anomaly Feed
              </span>
              <Badge variant="outline">{filteredAlerts.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 max-h-[600px] overflow-y-auto pr-2">
            {filteredAlerts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground italic">System Healthy</div>
            ) : filteredAlerts.map((alert) => (
              <div key={alert.id} onClick={() => setSelectedAlert(alert)} className="group border p-4 rounded-xl cursor-pointer hover:border-primary/50 bg-card shadow-sm transition-all hover:shadow-md">
                <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                        {alert.anomaly_type === 'shrinkage' ? <Ghost className="h-4 w-4 text-purple-600" /> : <AlertTriangle className="h-4 w-4 text-red-600" />}
                        <span className="font-bold text-sm">{alert.product_name}</span>
                    </div>
                    <Badge variant={alert.severity === "high" ? "destructive" : "outline"} className="text-[10px] uppercase tracking-tighter">
                        {alert.anomaly_type === "shrinkage" ? "Ghost" : alert.anomaly_type.replace("_", " ")}
                    </Badge>
                </div>
                <div className="text-xs text-slate-600 bg-muted/50 p-2 rounded border border-dashed leading-relaxed">
                    {alert.description}
                </div>
                <div className="flex justify-between items-center mt-3 text-[10px] text-muted-foreground font-medium uppercase tracking-widest">
                    <span>Detected {new Date(alert.detected_at).toLocaleDateString()}</span>
                    <span className="text-primary flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">Investigate <ArrowRight className="h-3 w-3" /></span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* --- FORECAST TABLE --- */}
        <Card className="lg:col-span-2 flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center text-lg">
                  <TrendingUp className="mr-2 h-5 w-5 text-blue-500" />
                  Demand Projections
                </CardTitle>
                <CardDescription>7-Day trend analysis and procurement suggestions.</CardDescription>
              </div>
              <div className="w-full sm:w-64 relative">
                <DebouncedInput 
                  value={forecastSearch}
                  onChange={(val) => setForecastSearch(val)}
                  isLoading={isForecastsLoading}
                  placeholder="Search products or SKU..."
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col pt-0">
            <div className="flex-1 overflow-auto rounded-md border">
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Daily Velocity</TableHead>
                    <TableHead className="hidden md:table-cell">AI Strategy</TableHead>
                    <TableHead className="text-right">Trend</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isForecastsLoading && forecasts.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="h-48 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                    ) : (
                        forecasts.map((item, idx) => (
                        <TableRow 
                            key={idx} 
                            className="transition-colors group"
                        >
                            <TableCell>
                            <div className="font-bold text-sm group-hover:text-blue-600 transition-colors">{item.product_name}</div>
                            <div className="text-[10px] text-muted-foreground uppercase">{item.product_sku}</div>
                            </TableCell>
                            <TableCell><Badge variant={item.current_stock < 10 ? "destructive" : "outline"}>{item.current_stock}</Badge></TableCell>
                            <TableCell className="font-medium text-primary">~{Number(item.predicted_quantity).toFixed(1)}/day</TableCell>
                            <TableCell className="hidden md:table-cell"><span className="text-xs font-medium text-slate-600">{item.reasoning}</span></TableCell>
                            <TableCell className="text-right">
                              {/* ✅ Restore Central Card Trigger */}
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 hover:text-blue-600"
                                onClick={() => fetchProductTrend(item.product, item.product_name)}
                              >
                                <LineChart className="h-4 w-4" />
                              </Button>
                            </TableCell>
                        </TableRow>
                        ))
                    )}
                </TableBody>
                </Table>
            </div>
            {!isForecastsLoading && forecastTotal > 0 && (
                <div className="flex items-center justify-between pt-4 border-t mt-4">
                    <p className="text-[10px] text-muted-foreground italic flex items-center gap-2"><Zap className="h-3 w-3 fill-amber-500 text-amber-500" /> Powered by Evolutionary V1 Engine</p>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" disabled={forecastPage === 1} onClick={() => loadForecasts(forecastPage - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                        <Button variant="outline" size="sm" disabled={forecastPage >= Math.ceil(forecastTotal / 10)} onClick={() => loadForecasts(forecastPage + 1)}><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ✅ RESTORED: Central Chart Modal Card */}
      {selectedProductChart && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <Card className="w-full max-w-4xl border-t-8 border-t-primary shadow-2xl relative">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <BarChart3 className="h-6 w-6 text-primary" />
                  {selectedProductChart.name}
                </CardTitle>
                <CardDescription>Predicted sales velocity for the next 7 days</CardDescription>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setSelectedProductChart(null)} 
                className="rounded-full hover:bg-muted"
              >
                <X className="h-6 w-6" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="h-[350px] w-full bg-slate-50/50 rounded-xl p-4 border border-dashed mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={selectedProductChart.data}>
                    <defs>
                      <linearGradient id="colorQty" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="prediction_date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fontSize: 12, fontWeight: 500}}
                      tickFormatter={(str) => new Date(str).toLocaleDateString(undefined, {weekday: 'short'})} 
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                    <ReChartsTooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      labelClassName="text-slate-900 font-bold" 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="predicted_quantity" 
                      stroke="#3b82f6" 
                      strokeWidth={3} 
                      fillOpacity={1} 
                      fill="url(#colorQty)" 
                      name="Predicted Units" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {selectedProductChart.data.map((day: any, i: number) => (
                  <div key={i} className="border-2 rounded-xl p-3 text-center bg-muted/20 hover:border-primary/30 transition-all group">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">
                      {new Date(day.prediction_date).toLocaleDateString(undefined, {weekday: 'short'})}
                    </p>
                    <p className="text-2xl font-black text-primary group-hover:scale-110 transition-transform">
                      {Number(day.predicted_quantity).toFixed(0)}
                    </p>
                    <p className="text-[9px] text-slate-500 font-medium leading-tight mt-1 line-clamp-2">
                      {day.reasoning}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading Overlay for Chart */}
      {isChartLoading && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      )}

      {selectedAlert && <InvestigationModal alert={selectedAlert} onClose={() => setSelectedAlert(null)} router={router} />}
    </div>
  );
}

function StatWidget({ title, value, icon: Icon, className, tooltip, onClick, isActive }: any) {
  return (
    <TooltipProvider>
      <Tooltip>
          <TooltipTrigger asChild>
              <Card onClick={onClick} className={`${className} relative cursor-pointer transition-all hover:scale-[1.02] active:scale-95 ${isActive ? "ring-2 ring-primary border-primary shadow-lg" : "border-transparent shadow-sm"}`}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</CardTitle>
                  <Icon className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                </CardHeader>
                <CardContent><div className="text-3xl font-black">{value ?? 0}</div></CardContent>
              </Card>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="w-64 p-3 bg-slate-900 text-white text-xs rounded-lg shadow-xl">
              <p className="leading-relaxed">{tooltip}</p>
          </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function InvestigationModal({ alert, onClose, router }: { alert: ExtendedAnomalyAlert; onClose: () => void; router: any; }) {
  const getSteps = () => {
    if (alert.anomaly_type === "shrinkage") {
      return ["Perform a physical stock count.", "Check for hidden/misplaced items.", "Verify recent unrecorded returns.", "Review Security footage."];
    }
    if (alert.anomaly_type === "stockout_risk") {
      return ["Review current stock vs demand velocity.", "Check description for AI-suggested supplier.", "Issue a new Purchase Order immediately.", "Notify procurement staff."];
    }
    if (alert.anomaly_type === "velocity_spike") {
      return ["Review today's receipts for bulk buys.", "Verify recent marketing surges.", "Check for cashier entry errors.", "Update demand baseline if legitimate."];
    }
    return ["Verify history.", "Check for data entry errors.", "Confirm with cashier."];
  };

  const handleAction = () => {
    onClose();
    if (alert.anomaly_type === "stockout_risk") {
        router.push(`/dashboard/purchases/create?product_id=${alert.product_id || ''}`);
    } else if (alert.anomaly_type === "shrinkage") {
        router.push("/dashboard/inventory");
    } else {
        router.push("/dashboard/sales/history");
    }
  };

  const colorConfig = {
    shrinkage: "bg-purple-600 text-white",
    stockout_risk: "bg-red-600 text-white",
    velocity_spike: "bg-blue-600 text-white"
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border animate-in zoom-in-95">
        <div className={`p-5 border-b flex justify-between items-center font-black uppercase tracking-widest text-sm ${colorConfig[alert.anomaly_type] || 'bg-slate-800 text-white'}`}>
            <h2>Investigation: {alert.product_name}</h2>
            <X className="h-5 w-5 cursor-pointer" onClick={onClose} />
        </div>
        <div className="p-8 space-y-6">
          <div className="bg-muted p-4 rounded-xl text-sm border-l-4 border-l-primary font-medium italic text-slate-700">"{alert.description}"</div>
          <div className="space-y-3">
            <p className="text-xs font-black uppercase text-muted-foreground flex items-center gap-2"><ClipboardList className="h-4 w-4" /> Recommended Steps:</p>
            <div className="grid gap-2">
                {getSteps().map((s, i) => (
                    <div key={i} className="flex gap-3 text-sm items-center p-2 rounded-lg bg-slate-50 border">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        <span className="text-slate-700 font-medium">{s}</span>
                    </div>
                ))}
            </div>
          </div>
        </div>
        <div className="p-5 border-t bg-slate-50 flex justify-end gap-3">
          <Button variant="ghost" className="font-bold uppercase text-xs" onClick={onClose}>Dismiss</Button>
          <Button className="font-bold uppercase text-xs px-6" onClick={handleAction}>
            {alert.anomaly_type === "stockout_risk" ? "Go to Procurement" : "Resolve Issues"}
          </Button>
        </div>
      </div>
    </div>
  );
}