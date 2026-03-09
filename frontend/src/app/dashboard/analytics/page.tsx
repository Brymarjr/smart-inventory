"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation"; //  Import Router for linking
import Link from "next/link"; // ✅ IMPORT LINK FOR THE PAYWALL
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
  Lock, // ✅ IMPORT LOCK ICON
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

// --- TYPES ---
type FilterType = "all" | "critical" | "ghost_stock" | "velocity_spike";

export default function AnalyticsPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ✅ State for Premium Lock
  const [isLocked, setIsLocked] = useState(false);
  const [lockMessage, setLockMessage] = useState("");

  // State for Filters & Modal
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [selectedAlert, setSelectedAlert] = useState<AnomalyAlert | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await forecastService.getDashboard();

      // ✅ Check if the backend locked us out
      if ("isLocked" in result && result.isLocked) {
        setIsLocked(true);
        setLockMessage(result.message);
        return; // Stop processing and show paywall
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

  useEffect(() => {
    loadData();
  }, []);

  // Filter Logic
  const getFilteredAlerts = () => {
    if (!data) return [];
    if (activeFilter === "all") return data.alerts;

    return data.alerts.filter((alert) => {
      if (activeFilter === "critical") return alert.severity === "high";
      if (activeFilter === "ghost_stock")
        return alert.anomaly_type === "shrinkage";
      if (activeFilter === "velocity_spike")
        return alert.anomaly_type === "velocity_spike";
      return true;
    });
  };

  // Helper for Title
  const getFilterTitle = () => {
    switch (activeFilter) {
      case "critical":
        return "Critical Risks";
      case "ghost_stock":
        return "Ghost Stock (Suspected Theft)";
      case "velocity_spike":
        return "Velocity Spikes";
      default:
        return "All Anomalies";
    }
  };

  if (loading && !data && !isLocked) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">
          Loading Intelligence...
        </span>
      </div>
    );
  }

  // ✅ THE PAYWALL UI
  if (isLocked) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-center max-w-md mx-auto animate-in fade-in duration-500">
        <div className="bg-primary/10 p-6 rounded-full mb-6">
          <Lock className="w-12 h-12 text-primary" />
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-3">
          Enterprise Intelligence
        </h2>
        <p className="text-muted-foreground mb-8 leading-relaxed">
          {lockMessage ||
            "Unlock AI-driven demand forecasting, anomaly detection, and advanced inventory insights by upgrading your plan."}
        </p>
        <Link href="/dashboard/billing">
          <Button
            size="lg"
            className="w-full font-bold text-md h-12 rounded-xl"
          >
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
        <Button onClick={loadData} variant="outline" className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const { summary, forecasts } = data;
  const filteredAlerts = getFilteredAlerts();

  return (
    <div className="space-y-6 p-6 relative">
      {/* --- HEADER --- */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Intelligence Center
          </h1>
          <p className="text-muted-foreground">
            {activeFilter === "all"
              ? "Overview of system health and AI predictions."
              : `Filtered View: Showing ${getFilterTitle()}.`}
          </p>
        </div>
        <div className="flex gap-2">
          {activeFilter !== "all" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveFilter("all")}
            >
              <FilterX className="mr-2 h-4 w-4" />
              Clear Filter
            </Button>
          )}

          {/* ✅ FIXED REFRESH BUTTON: Spins when loading */}
          <Button
            onClick={loadData}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            {loading ? "Refreshing..." : "Refresh Data"}
          </Button>
        </div>
      </div>

      {/* --- 1. INTERACTIVE SUMMARY CARDS --- */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatWidget
          title="Total Anomalies"
          value={summary.total_alerts}
          icon={AlertTriangle}
          tooltip="Total number of issues detected by AI that require attention."
          isActive={activeFilter === "all"}
          onClick={() => setActiveFilter("all")}
          className={
            summary.total_alerts > 0 ? "border-red-200 bg-red-50/50" : ""
          }
        />
        <StatWidget
          title="Critical Risks"
          value={summary.critical_alerts}
          icon={Activity}
          tooltip="Items that will run out of stock in less than 3 days based on current sales velocity."
          isActive={activeFilter === "critical"}
          onClick={() => setActiveFilter("critical")}
          className={
            summary.critical_alerts > 0
              ? "border-red-400 bg-red-100 text-red-900"
              : ""
          }
        />
        <StatWidget
          title="Ghost Stock"
          value={summary.ghost_stock}
          icon={PackageX}
          tooltip="POSSIBLE THEFT: The system thinks you have stock, but sales have stopped completely for over 7 days."
          isActive={activeFilter === "ghost_stock"}
          onClick={() => setActiveFilter("ghost_stock")}
        />
        <StatWidget
          title="Velocity Spikes"
          value={summary.velocity_spikes}
          icon={TrendingUp}
          tooltip="Unusual sales volume in a single day. Could be a bulk buyer, or a cashier typing error (e.g. 100 instead of 1)."
          isActive={activeFilter === "velocity_spike"}
          onClick={() => setActiveFilter("velocity_spike")}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
        {/* --- 2. DYNAMIC ANOMALY FEED (Left Column) --- */}
        <Card
          className={`lg:col-span-1 border-l-4 transition-colors ${
            activeFilter === "ghost_stock"
              ? "border-l-purple-500"
              : activeFilter === "velocity_spike"
                ? "border-l-blue-500"
                : activeFilter === "critical"
                  ? "border-l-red-500"
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
              {activeFilter === "all"
                ? "All issues requiring verification."
                : `Showing: ${getFilterTitle()}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 max-h-[600px] overflow-y-auto">
            {filteredAlerts.length === 0 ? (
              <div className="text-center py-8">
                <div className="bg-slate-100 text-muted-foreground p-3 rounded-full inline-block mb-2">
                  <TrendingUp size={24} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {activeFilter === "all"
                    ? "System Healthy. No anomalies detected."
                    : `No ${getFilterTitle()} found.`}
                </p>
              </div>
            ) : (
              filteredAlerts.map((alert) => (
                <div
                  key={alert.id}
                  onClick={() => setSelectedAlert(alert)} // OPEN MODAL
                  className="group flex flex-col space-y-1 rounded-lg border p-3 bg-card shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm group-hover:text-blue-600 transition-colors">
                      {alert.product_name}
                    </span>
                    <Badge
                      variant={
                        alert.severity === "high" ? "destructive" : "outline"
                      }
                      className="text-[10px] uppercase"
                    >
                      {alert.anomaly_type === "shrinkage"
                        ? "Ghost Stock"
                        : alert.anomaly_type.replace("_", " ")}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">
                    {alert.product_sku}
                  </p>
                  <div className="bg-muted p-2 rounded mt-2 text-xs text-slate-700 border border-slate-100 group-hover:bg-blue-50 group-hover:border-blue-100 transition-colors">
                    {alert.description}
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-[10px] text-muted-foreground">
                      Detected:{" "}
                      {new Date(alert.detected_at).toLocaleDateString()}
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

        {/* --- 3. FORECAST TABLE (Right 2 Columns) --- */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <TrendingUp className="mr-2 h-5 w-5 text-blue-500" />
              AI Demand Forecast (Next 7 Days)
            </CardTitle>
            <CardDescription>
              Predicts future sales based on historical trends.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Current Stock</TableHead>
                  <TableHead>Predicted Demand</TableHead>
                  <TableHead className="hidden md:table-cell">
                    AI Reasoning
                  </TableHead>
                  <TableHead>Recommendation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forecasts.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <div className="font-medium">{item.product_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.product_sku}
                      </div>
                    </TableCell>
                    <TableCell>{item.current_stock}</TableCell>
                    <TableCell>
                      <span className="font-bold text-blue-600 text-lg">
                        {item.predicted_quantity.toFixed(0)}
                      </span>
                      <span className="text-xs text-muted-foreground ml-1">
                        units
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="secondary" className="font-normal">
                        {item.reasoning}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <ActionBadge action={item.recommended_action} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* --- 4. INVESTIGATION MODAL (Connected to Router) --- */}
      {selectedAlert && (
        <InvestigationModal
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
          router={router} // Pass router to modal
        />
      )}
    </div>
  );
}

// --- SUB-COMPONENTS ---

function StatWidget({
  title,
  value,
  icon: Icon,
  className,
  tooltip,
  onClick,
  isActive,
}: any) {
  return (
    <Card
      onClick={onClick}
      className={`
        ${className} 
        relative group cursor-pointer transition-all hover:shadow-md active:scale-95 select-none
        ${isActive ? "ring-2 ring-primary border-primary shadow-md" : "border-transparent hover:border-gray-300"}
      `}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {title}

          {/* FIXED TOOLTIP: Uses simple group-hover logic */}
          {tooltip && (
            <div className="relative group/info ml-1 z-50">
              <Info className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors cursor-help" />

              {/* Tooltip Content */}
              <div className="absolute hidden group-hover/info:block bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2 bg-slate-900 text-white text-xs rounded shadow-lg z-50 pointer-events-none">
                {tooltip}
                {/* Small arrow */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
              </div>
            </div>
          )}
        </CardTitle>
        <Icon
          className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground"}`}
        />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function ActionBadge({ action }: { action: string }) {
  let variant: "default" | "secondary" | "destructive" | "outline" = "outline";

  if (action.includes("Urgent")) variant = "destructive";
  else if (action.includes("Reorder")) variant = "default";
  else if (action.includes("Healthy")) variant = "outline";

  return (
    <Badge variant={variant} className="whitespace-nowrap">
      {action}
    </Badge>
  );
}

// --- SMART MODAL WITH REAL LINKS ---
function InvestigationModal({
  alert,
  onClose,
  router,
}: {
  alert: AnomalyAlert;
  onClose: () => void;
  router: any;
}) {
  // Logic to determine steps based on anomaly type
  const getSteps = () => {
    if (alert.anomaly_type === "shrinkage") {
      // Ghost Stock
      return [
        "Go to the physical location of this product.",
        "Perform a manual count of items on the shelf.",
        "Check the 'Returns' bin and 'Backroom' inventory.",
        "If physical count is 0, use 'Stock Adjustment' to set quantity to 0.",
        "Review Security Camera footage for the last 5 days (optional).",
      ];
    } else if (alert.anomaly_type === "velocity_spike") {
      return [
        "Go to 'Sales History' for the date of the spike.",
        "Look for a single transaction with unusually high quantity.",
        "Verify if this was a legitimate bulk order.",
        "If it looks like a typo (e.g., scanned once, entered '200'), void the transaction.",
        "Contact the cashier who processed the sale for confirmation.",
      ];
    }
    return ["Review recent inventory logs.", "Check for data entry errors."];
  };

  const steps = getSteps();
  const title =
    alert.anomaly_type === "shrinkage"
      ? "Ghost Stock Resolution"
      : "Velocity Spike Audit";
  const colorClass =
    alert.anomaly_type === "shrinkage"
      ? "text-purple-600 bg-purple-50"
      : "text-blue-600 bg-blue-50";

  //  DYNAMIC BUTTON TEXT & ACTION (Links to Real Pages)
  const btnText =
    alert.anomaly_type === "shrinkage"
      ? "Go to Inventory"
      : "View Sales History";
  const btnAction = () => {
    if (alert.anomaly_type === "shrinkage") {
      router.push("/dashboard/inventory"); //  Link to Inventory
    } else {
      router.push("/dashboard/sales/history"); //  Link to Sales history (Transactions)
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-card rounded-lg shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div
          className={`p-4 border-b flex justify-between items-center ${colorClass}`}
        >
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            <h2 className="font-bold text-lg">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="hover:bg-black/10 rounded-full p-1 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Context */}
          <div className="bg-muted p-3 rounded-md border border-slate-100">
            <h3 className="text-sm font-semibold text-foreground mb-1">
              Why was this flagged?
            </h3>
            <p className="text-sm text-slate-600">{alert.description}</p>
          </div>

          {/* Checklist */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center">
              <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
              Recommended Course of Action
            </h3>
            <ul className="space-y-3">
              {steps.map((step, i) => (
                <li key={i} className="flex items-start text-sm text-slate-700">
                  <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full border border-slate-300 text-[10px] text-muted-foreground mr-3 mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            className={
              alert.anomaly_type === "shrinkage"
                ? "bg-purple-600 hover:bg-purple-700"
                : "bg-blue-600 hover:bg-blue-700"
            }
            onClick={btnAction}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            {btnText}
          </Button>
        </div>
      </div>
    </div>
  );
}
