"use client";

import React, { useEffect, useState } from "react";
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
  Search
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

import { DebouncedInput } from "@/components/shared/debounced-input";

// --- TYPES ---
// ✅ FIX: Added "stockout_risk" and refined the alert type
type FilterType = "all" | "critical" | "ghost_stock" | "velocity_spike";

interface ExtendedAnomalyAlert {
  id: number;
  product_name: string;
  product_sku: string;
  anomaly_type: "shrinkage" | "velocity_spike" | "stockout_risk";
  severity: "low" | "medium" | "high";
  description: string;
  detected_at: string;
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [isLocked, setIsLocked] = useState(false);
  const [lockMessage, setLockMessage] = useState("");

  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [selectedAlert, setSelectedAlert] = useState<ExtendedAnomalyAlert | null>(null);

  const [forecasts, setForecasts] = useState<any[]>([]);
  const [forecastPage, setForecastPage] = useState(1);
  const [forecastTotal, setForecastTotal] = useState(0);
  const [forecastSearch, setForecastSearch] = useState(""); 
  const [isForecastsLoading, setIsForecastsLoading] = useState(false);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
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
      setError("");
    } catch (err) {
      console.error(err);
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

  const loadChartData = async (productId: number) => {
    setIsChartLoading(true);
    setChartData([]);
    try {
      const res = await api.get(`/api/forecasts/product_chart/?product_id=${productId}`);
      setChartData(res.data.timeline);
    } catch (err) {
      console.error("Failed to load chart", err);
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

  const getFilterTitle = () => {
    switch (activeFilter) {
      case "critical": return "Critical Risks";
      case "ghost_stock": return "Ghost Stock (Suspected Theft)";
      case "velocity_spike": return "Velocity Spikes";
      default: return "All Anomalies";
    }
  };

  const openDrawer = (productData: any) => {
    setSelectedProduct(productData);
    setIsDrawerOpen(true);
    if (productData.product) {
      loadChartData(productData.product);
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

  if (!data) return <></>;
  const { summary } = data;
  const filteredAlerts = getFilteredAlerts();

  return (
    <div className="space-y-6 p-6 relative">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Intelligence Center</h1>
          <p className="text-muted-foreground">
            {activeFilter === "all"
              ? "Overview of system health and AI predictions."
              : `Filtered View: Showing ${getFilterTitle()}.`}
          </p>
        </div>
        <div className="flex gap-2">
          {activeFilter !== "all" && (
            <Button variant="ghost" size="sm" onClick={() => setActiveFilter("all")}>
              <FilterX className="mr-2 h-4 w-4" /> Clear Filter
            </Button>
          )}
          <Button
            onClick={() => { loadDashboard(); loadForecasts(1); }}
            variant="outline"
            size="sm"
            disabled={loading || isForecastsLoading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading || isForecastsLoading ? "animate-spin" : ""}`} />
            {loading || isForecastsLoading ? "Refreshing..." : "Refresh Data"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatWidget
          title="Total Anomalies"
          value={summary?.total_alerts || 0}
          icon={AlertTriangle}
          tooltip="Total number of issues detected by AI that require attention."
          isActive={activeFilter === "all"}
          onClick={() => setActiveFilter("all")}
          className={summary?.total_alerts > 0 ? "border-red-200 bg-red-50/50" : ""}
        />
        <StatWidget
          title="Critical Risks"
          value={summary?.critical_alerts || 0}
          icon={Activity}
          tooltip="Items that will run out of stock in less than 3 days based on current sales velocity."
          isActive={activeFilter === "critical"}
          onClick={() => setActiveFilter("critical")}
          className={summary?.critical_alerts > 0 ? "border-red-400 bg-red-100 text-red-900" : ""}
        />
        <StatWidget
          title="Ghost Stock"
          value={summary?.ghost_stock || 0}
          icon={PackageX}
          tooltip="POSSIBLE THEFT: The system thinks you have stock, but sales have stopped completely for over 7 days."
          isActive={activeFilter === "ghost_stock"}
          onClick={() => setActiveFilter("ghost_stock")}
        />
        <StatWidget
          title="Velocity Spikes"
          value={summary?.velocity_spikes || 0}
          icon={TrendingUp}
          tooltip="Unusual sales volume in a single day. Could be a bulk buyer, or a cashier typing error."
          isActive={activeFilter === "velocity_spike"}
          onClick={() => setActiveFilter("velocity_spike")}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
        <Card
          className={`lg:col-span-1 border-l-4 transition-colors ${
            activeFilter === "ghost_stock" ? "border-l-purple-500"
              : activeFilter === "velocity_spike" ? "border-l-blue-500"
              : activeFilter === "critical" ? "border-l-red-500"
              : "border-l-yellow-400"
          }`}
        >
          <CardHeader>
            <CardTitle className="flex items-center text-lg justify-between">
              <span className="flex items-center">
                <AlertTriangle className="mr-2 h-5 w-5 text-muted-foreground" />
                Anomaly Feed
              </span>
              <Badge variant="outline">{filteredAlerts.length}</Badge>
            </CardTitle>
            <CardDescription>
              {activeFilter === "all" ? "All issues requiring verification." : `Showing: ${getFilterTitle()}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 max-h-[600px] overflow-y-auto">
            {filteredAlerts.length === 0 ? (
              <div className="text-center py-8">
                <div className="bg-slate-100 text-muted-foreground p-3 rounded-full inline-block mb-2">
                  <TrendingUp size={24} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {activeFilter === "all" ? "System Healthy. No anomalies detected." : `No ${getFilterTitle()} found.`}
                </p>
              </div>
            ) : (
              filteredAlerts.map((alert) => (
                <div
                  key={alert.id}
                  onClick={() => setSelectedAlert(alert)}
                  className="group flex flex-col space-y-1 rounded-lg border p-3 bg-card shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm group-hover:text-blue-600 transition-colors">
                      {alert.product_name}
                    </span>
                    <Badge variant={alert.severity === "high" ? "destructive" : "outline"} className="text-[10px] uppercase">
                      {alert.anomaly_type === "shrinkage" ? "Ghost Stock" : alert.anomaly_type.replace("_", " ")}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">{alert.product_sku}</p>
                  <div className="bg-muted p-2 rounded mt-2 text-xs text-slate-700 border border-slate-100 group-hover:bg-blue-50 group-hover:border-blue-100 transition-colors">
                    {alert.description}
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-[10px] text-muted-foreground">
                      Detected: {new Date(alert.detected_at).toLocaleDateString()}
                    </span>
                    <span className="text-[10px] font-medium text-blue-600 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                      Investigate <ArrowRight className="ml-1 h-3 w-3" />
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* --- 3. FORECAST TABLE --- */}
        <Card className="lg:col-span-2 flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center text-lg">
                  <TrendingUp className="mr-2 h-5 w-5 text-blue-500" />
                  Tomorrow's Demand Forecast
                </CardTitle>
                <CardDescription>
                  Predicts future sales based on historical trends.
                </CardDescription>
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
                    <TableHead>Predicted</TableHead>
                    <TableHead className="hidden md:table-cell">AI Reasoning</TableHead>
                    <TableHead>Recommendation</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isForecastsLoading && forecasts.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="h-48 text-center">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto mb-2" />
                                <span className="text-sm text-muted-foreground">Analyzing patterns...</span>
                            </TableCell>
                        </TableRow>
                    ) : forecasts.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="h-48 text-center text-muted-foreground">
                                {forecastSearch ? `No forecasts found matching "${forecastSearch}"` : "No forecasts generated yet."}
                            </TableCell>
                        </TableRow>
                    ) : (
                        forecasts.map((item, idx) => (
                        <TableRow 
                            key={idx} 
                            onClick={() => openDrawer(item)}
                            className="cursor-pointer hover:bg-slate-50 transition-colors group"
                        >
                            <TableCell>
                            <div className="font-medium group-hover:text-blue-600 transition-colors">{item.product_name}</div>
                            <div className="text-xs text-muted-foreground">{item.product_sku}</div>
                            </TableCell>
                            <TableCell>{item.current_stock}</TableCell>
                            <TableCell>
                            <span className="font-bold text-blue-600 text-lg">
                                {item.predicted_quantity?.toFixed(0) || 0}
                            </span>
                            <span className="text-xs text-muted-foreground ml-1">units</span>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                            <Badge variant="secondary" className="font-normal">{item.reasoning}</Badge>
                            </TableCell>
                            <TableCell>
                            <ActionBadge action={item.recommended_action} />
                            </TableCell>
                        </TableRow>
                        ))
                    )}
                </TableBody>
                </Table>
            </div>
            {!isForecastsLoading && forecastTotal > 0 && (
                <div className="flex items-center justify-between pt-4 border-t mt-4">
                    <span className="text-sm text-muted-foreground">
                        Showing page {forecastPage} of {Math.ceil(forecastTotal / 10)} ({forecastTotal} total)
                    </span>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={forecastPage === 1}
                            onClick={() => loadForecasts(forecastPage - 1)}
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={forecastPage >= Math.ceil(forecastTotal / 10)}
                            onClick={() => loadForecasts(forecastPage + 1)}
                        >
                            Next <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>
                </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedAlert && (
        <InvestigationModal alert={selectedAlert} onClose={() => setSelectedAlert(null)} router={router} />
      )}

      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent className="sm:max-w-md w-full border-l overflow-y-auto">
          <SheetHeader className="pb-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              7-Day Demand Trend
            </SheetTitle>
            <SheetDescription>
              Future projections for {selectedProduct?.product_name || "this product"}
            </SheetDescription>
          </SheetHeader>
          <div className="py-6">
            <div className="bg-slate-50 p-4 rounded-lg border mb-6">
                <div className="text-xs text-muted-foreground font-mono mb-1">{selectedProduct?.product_sku}</div>
                <div className="text-lg font-bold text-foreground">{selectedProduct?.product_name}</div>
                <div className="flex gap-4 mt-3">
                    <div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Current Stock</div>
                        <div className={`text-lg font-medium ${selectedProduct?.current_stock <= 0 ? 'text-red-600' : ''}`}>{selectedProduct?.current_stock}</div>
                    </div>
                    <div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Tomorrow's Need</div>
                        <div className="text-lg font-medium text-blue-600">{selectedProduct?.predicted_quantity?.toFixed(0)}</div>
                    </div>
                </div>
            </div>
            <h3 className="font-semibold text-sm mb-4">Projected Timeline</h3>
            {isChartLoading ? (
                <div className="flex flex-col items-center justify-center h-48 bg-slate-50 rounded-lg border border-dashed">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-2" />
                    <span className="text-sm text-muted-foreground">Building chart...</span>
                </div>
            ) : chartData.length === 0 ? (
                <div className="text-center p-6 text-muted-foreground bg-slate-50 rounded-lg border">No timeline data available.</div>
            ) : (
                <div className="space-y-6">
                    <div className="flex items-end gap-2 h-48 pt-4 pb-2 border-b">
                        {chartData.map((day, idx) => {
                            const maxQty = Math.max(...chartData.map(d => d.predicted_quantity), 1);
                            const heightPercentage = `${(day.predicted_quantity / maxQty) * 100}%`;
                            const dateObj = new Date(day.prediction_date);
                            const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                            return (
                                <div key={idx} className="flex flex-col items-center flex-1 group h-full justify-end">
                                    <div className="text-xs font-bold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity mb-1">{day.predicted_quantity.toFixed(0)}</div>
                                    <div className="w-full bg-blue-50 rounded-t-md relative flex items-end justify-center hover:bg-blue-100 transition-colors border border-b-0 border-blue-100" style={{ height: '100%' }}>
                                        <div className="w-full bg-blue-500 rounded-t-sm transition-all duration-500 shadow-sm" style={{ height: heightPercentage }} />
                                    </div>
                                    <div className="text-[10px] text-slate-500 font-medium mt-2 uppercase">{idx === 0 ? 'Tmrw' : dayName}</div>
                                </div>
                            )
                        })}
                    </div>
                    <div className="space-y-3">
                        <h3 className="font-semibold text-sm">Daily Breakdown</h3>
                        {chartData.map((day, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm p-2 rounded hover:bg-slate-50 border-b last:border-0">
                                <span className="text-muted-foreground w-24">{new Date(day.prediction_date).toLocaleDateString()}</span>
                                <span className="font-medium text-blue-600 w-12 text-right">{day.predicted_quantity.toFixed(0)}</span>
                                <span className="text-xs text-slate-500 flex-1 text-right truncate pl-4">{day.reasoning}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function StatWidget({ title, value, icon: Icon, className, tooltip, onClick, isActive }: any) {
  return (
    <Card onClick={onClick} className={`${className} relative group cursor-pointer transition-all hover:shadow-md active:scale-95 select-none ${isActive ? "ring-2 ring-primary border-primary shadow-md" : "border-transparent hover:border-gray-300"}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {title}
          {tooltip && (
            <div className="relative group/info ml-1 z-50">
              <Info className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors cursor-help" />
              <div className="absolute hidden group-hover/info:block bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2 bg-slate-900 text-white text-xs rounded shadow-lg z-50 pointer-events-none">
                {tooltip}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
              </div>
            </div>
          )}
        </CardTitle>
        <Icon className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
      </CardHeader>
      <CardContent><div className="text-2xl font-bold">{value}</div></CardContent>
    </Card>
  );
}

function ActionBadge({ action }: { action: string }) {
  let variant: "default" | "secondary" | "destructive" | "outline" = "outline";
  if (action?.includes("Urgent")) variant = "destructive";
  else if (action?.includes("Reorder")) variant = "default";
  else if (action?.includes("Healthy")) variant = "outline";
  return (<Badge variant={variant} className="whitespace-nowrap">{action || "Healthy"}</Badge>);
}

function InvestigationModal({ alert, onClose, router }: { alert: ExtendedAnomalyAlert; onClose: () => void; router: any; }) {
  let title = "";
  let colorClass = "";
  let btnText = "";
  let btnClass = "";
  let steps: string[] = [];
  let btnAction = () => {};

  // ✅ Updated switch to include stockout_risk
  switch (alert.anomaly_type) {
    case "shrinkage":
      title = "Ghost Stock Resolution";
      colorClass = "text-purple-600 bg-purple-50";
      btnClass = "bg-purple-600 hover:bg-purple-700 text-white";
      btnText = "Go to Inventory";
      steps = ["Go to the physical location.", "Perform manual count.", "Check returns/backroom.", "If 0, use 'Stock Adjustment'.", "Review Security Camera footage."];
      btnAction = () => { router.push("/dashboard/inventory"); onClose(); };
      break;
    case "velocity_spike":
      title = "Velocity Spike Audit";
      colorClass = "text-blue-600 bg-blue-50";
      btnClass = "bg-blue-600 hover:bg-blue-700 text-white";
      btnText = "View Sales History";
      steps = ["Go to 'Sales History'.", "Look for unusual high quantity.", "Verify if bulk order.", "Void if typo.", "Contact cashier."];
      btnAction = () => { router.push("/dashboard/sales"); onClose(); };
      break;
    case "stockout_risk":
      title = "Critical Stockout Prevention";
      colorClass = "text-red-600 bg-red-50";
      btnClass = "bg-red-600 hover:bg-red-700 text-white";
      btnText = "Order from Suppliers";
      steps = ["Review stock vs predicted demand.", "Check pending POs.", "Contact primary supplier.", "Generate new PO immediately."];
      btnAction = () => { router.push("/dashboard/purchases"); onClose(); };
      break;
    default:
      title = "Anomaly Investigation";
      colorClass = "text-slate-600 bg-slate-50";
      btnClass = "bg-slate-800 hover:bg-slate-900 text-white";
      btnText = "Close";
      steps = ["Review recent inventory logs.", "Check for data entry errors."];
      btnAction = () => onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-card rounded-lg shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
        <div className={`p-4 border-b flex justify-between items-center ${colorClass}`}>
          <div className="flex items-center gap-2"><ClipboardList className="h-5 w-5" /><h2 className="font-bold text-lg">{title}</h2></div>
          <button onClick={onClose} className="hover:bg-black/10 rounded-full p-1"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6 space-y-6">
          <div className="bg-muted p-3 rounded-md border border-slate-100">
            <h3 className="text-sm font-semibold text-foreground mb-1">Why was this flagged?</h3>
            <p className="text-sm text-slate-600">{alert.description}</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center"><CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />Recommended Course of Action</h3>
            <ul className="space-y-3">
              {steps.map((step, i) => (<li key={i} className="flex items-start text-sm text-slate-700"><span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full border border-slate-300 text-[10px] text-muted-foreground mr-3 mt-0.5">{i + 1}</span>{step}</li>))}
            </ul>
          </div>
        </div>
        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3"><Button variant="outline" onClick={onClose}>Close</Button><Button className={btnClass} onClick={btnAction}><ExternalLink className="mr-2 h-4 w-4" />{btnText}</Button></div>
      </div>
    </div>
  );
}