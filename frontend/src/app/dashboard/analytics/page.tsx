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
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"; 
import { toast } from "sonner";

type FilterType = "all" | "critical" | "ghost_stock" | "velocity_spike";

export default function AnalyticsPage() {
  const router = useRouter();
  
  const [data, setData] = useState<DashboardData | null>(null);
  const [forecasts, setForecasts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [nextPage, setNextPage] = useState<string | null>(null);
  const [prevPage, setPrevPage] = useState<string | null>(null);

  const [isLocked, setIsLocked] = useState(false);
  const [lockMessage, setLockMessage] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [selectedAlert, setSelectedAlert] = useState<AnomalyAlert | null>(null);
  const [selectedProductChart, setSelectedProductChart] = useState<{name: string, data: any[]} | null>(null);

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
      setError("Failed to connect to Intelligence Engine.");
    }
  };

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

  useEffect(() => {
    const timer = setTimeout(() => {
      loadForecasts("/api/forecasts/", searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, loadForecasts]);

  const fetchProductTrend = async (productId: any, productName: string) => {
    try {
      const { data } = await api.get(`/api/forecasts/product_chart/?product_id=${productId}`);
      setSelectedProductChart({ name: productName, data: data.timeline });
    } catch (err) {
      toast.error("Failed to load trend data");
    }
  };

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
            <Button variant="ghost" size="sm" onClick={() => setActiveFilter("all")}><FilterX className="mr-2 h-4 w-4" /> Reset</Button>
          )}
          <Button onClick={() => { loadSummary(); loadForecasts(); }} variant="outline" size="sm">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Sync
          </Button>
        </div>
      </div>

      <TooltipProvider>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatWidget 
            title="Total Anomalies" value={summary.total_alerts} icon={AlertTriangle} 
            isActive={activeFilter === "all"} onClick={() => setActiveFilter("all")} 
            className={summary.total_alerts > 0 ? "border-red-200 bg-red-50/50" : ""}
            description="Total number of irregularities detected across your entire stock catalog."
        />
        <StatWidget 
            title="Critical Risks" value={summary.critical_alerts} icon={Activity} 
            isActive={activeFilter === "critical"} onClick={() => setActiveFilter("critical")} 
            className={summary.critical_alerts > 0 ? "border-red-400 bg-red-100" : ""} 
            description="Products at high risk of stockout within 14 days based on current velocity."
        />
        <StatWidget 
            title="Ghost Stock" value={summary.ghost_stock} icon={Ghost} 
            isActive={activeFilter === "ghost_stock"} onClick={() => setActiveFilter("ghost_stock")} 
            description="Products with positive stock levels but zero recorded sales for over 7 days."
        />
        <StatWidget 
            title="Velocity Spikes" value={summary.velocity_spikes} icon={TrendingUp} 
            isActive={activeFilter === "velocity_spike"} onClick={() => setActiveFilter("velocity_spike")} 
            description="Sudden surges in demand that deviate significantly from the 90-day average."
        />
      </div>
      </TooltipProvider>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
        <Card className={`lg:col-span-1 border-l-4 ${activeFilter === 'ghost_stock' ? 'border-l-purple-500' : activeFilter === 'velocity_spike' ? 'border-l-blue-500' : 'border-l-red-500'}`}>
          <CardHeader><CardTitle className="text-lg">Anomaly Feed</CardTitle></CardHeader>
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

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div><CardTitle>Demand Projections</CardTitle><CardDescription>7-Day trend analysis and procurement suggestions.</CardDescription></div>
              <div className="relative w-full md:w-64"><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search catalog..." className="pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Stock</TableHead><TableHead>Daily Velocity</TableHead><TableHead>Strategy</TableHead><TableHead className="text-right">Trend</TableHead></TableRow></TableHeader>
              <TableBody>
                {forecasts.map((item, idx) => (
                  <TableRow key={idx} className="group transition-colors">
                    <TableCell>
                      <div className="font-bold text-sm">{item.product_name}</div>
                      <div className="text-[10px] text-muted-foreground uppercase">{item.product_sku}</div>
                    </TableCell>
                    <TableCell><Badge variant={item.current_stock < 10 ? "destructive" : "outline"}>{item.current_stock}</Badge></TableCell>
                    <TableCell className="font-medium text-primary">~{Number(item.predicted_quantity).toFixed(1)}/day</TableCell>
                    <TableCell><span className="text-xs font-medium text-slate-600">{item.reasoning}</span></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-blue-600" onClick={() => fetchProductTrend(item.product, item.product_name)}>
                        <LineChart className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-[10px] text-muted-foreground italic flex items-center gap-2"><Zap className="h-3 w-3 fill-amber-500 text-amber-500" /> Powered by Evolutionary V1 Forecasting Engine</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={!prevPage} onClick={() => loadForecasts(prevPage!)}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="sm" disabled={!nextPage} onClick={() => loadForecasts(nextPage!)}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {selectedProductChart && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <Card className="w-full max-w-4xl border-t-8 border-t-primary">
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle className="text-2xl">{selectedProductChart.name}</CardTitle><CardDescription>Predicted sales velocity for the next 7 days</CardDescription></div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedProductChart(null)} className="rounded-full"><X className="h-6 w-6" /></Button>
            </CardHeader>
            <CardContent>
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={selectedProductChart.data}>
                    <defs><linearGradient id="colorQty" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="prediction_date" axisLine={false} tickLine={false} tickFormatter={(str) => new Date(str).toLocaleDateString(undefined, {weekday: 'short'})} /><YAxis axisLine={false} tickLine={false} /><ReChartsTooltip labelClassName="text-slate-900 font-bold" />
                    <Area type="monotone" dataKey="predicted_quantity" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorQty)" name="Predicted Units" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mt-8">
                {selectedProductChart.data.map((day: any, i: number) => (
                  <div key={i} className="border-2 rounded-xl p-3 text-center bg-muted/20 hover:border-primary/30 transition-all">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">{new Date(day.prediction_date).toLocaleDateString(undefined, {weekday: 'short'})}</p>
                    <p className="text-2xl font-black text-primary">{Number(day.predicted_quantity).toFixed(0)}</p>
                    <p className="text-[9px] text-slate-500 font-medium leading-tight mt-1">{day.reasoning}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedAlert && <InvestigationModal alert={selectedAlert} onClose={() => setSelectedAlert(null)} router={router} />}
    </div>
  );
}

function StatWidget({ title, value, icon: Icon, className, description, onClick, isActive }: any) {
  return (
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
            <p className="leading-relaxed">{description}</p>
        </TooltipContent>
    </Tooltip>
  );
}

function InvestigationModal({ alert, onClose, router }: any) {
  const getSteps = () => {
    // Meaningful steps based on actual anomaly types
    if (alert.anomaly_type === "shrinkage") {
      return [
        "Perform an immediate physical stock count for this item.",
        "Verify if the item was misplaced or hidden in the store.",
        "Check POS return logs for unrecorded stock additions.",
        "Update the inventory record to reflect the physical reality."
      ];
    }
    if (alert.anomaly_type === "stockout_risk") {
      return [
        "Check current cash flow availability for restocking.",
        "Review the AI-suggested supplier in the alert description.",
        "Issue a new Purchase Order immediately to avoid stockout.",
        "Notify relevant staff of the critical stock status."
      ];
    }
    if (alert.anomaly_type === "velocity_spike") {
      return [
        "Review today's receipts to identify bulk purchases.",
        "Verify if a recent marketing campaign caused the surge.",
        "Check for data entry errors in the latest recorded sales.",
        "Ensure procurement can keep up with the new velocity."
      ];
    }
    return ["Verify history.", "Check for data entry errors.", "Confirm with cashier."];
  };

  const handleAction = () => {
    onClose();
    // Logical routing based on anomaly intent
    if (alert.anomaly_type === "stockout_risk") {
        router.push("/dashboard/purchases/create");
    } else if (alert.anomaly_type === "shrinkage") {
        router.push("/dashboard/inventory");
    } else {
        router.push("/dashboard/sales/history");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in zoom-in-95 duration-200">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border">
        <div className={`p-5 border-b flex justify-between items-center font-black uppercase tracking-widest text-sm ${alert.anomaly_type === 'shrinkage' ? 'bg-purple-600 text-white' : alert.anomaly_type === 'stockout_risk' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'}`}>
            <h2>Investigation: {alert.product_name}</h2>
            <X className="h-5 w-5 cursor-pointer hover:rotate-90 transition-transform" onClick={onClose} />
        </div>
        <div className="p-8 space-y-6">
          <div className="bg-muted p-4 rounded-xl text-sm border-l-4 border-l-primary font-medium leading-relaxed italic text-slate-700">"{alert.description}"</div>
          <div className="space-y-3">
            <p className="text-xs font-black uppercase text-muted-foreground flex items-center gap-2"><ClipboardList className="h-4 w-4" /> Recommended Actions:</p>
            <div className="grid gap-2">
                {getSteps().map((s, i) => (
                    <div key={i} className="flex gap-3 text-sm items-center p-2 rounded-lg bg-slate-50 border border-slate-100">
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