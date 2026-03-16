"use client";

import { useState, useEffect, useRef } from "react";
import api from "@/lib/api";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, BrainCircuit, Play, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";

interface TenantTrainingCardProps {
  tenantId: string;
  tenantName: string;
}

export function TenantTrainingCard({
  tenantId,
  tenantName,
}: TenantTrainingCardProps) {
  const [isTraining, setIsTraining] = useState(false);
  const [lastTrained, setLastTrained] = useState<Date | null>(null);
  const [status, setStatus] = useState<"idle" | "training" | "complete">(
    "idle",
  );

  const pollInterval = useRef<NodeJS.Timeout | null>(null);

  const fetchStatus = async () => {
    try {
      // ✅ ANTI-CACHE: Add timestamp to URL to force fresh fetch
      const { data } = await api.get(
        `/api/admin/train-models/${tenantId}/?t=${Date.now()}`,
      );

      const serverDate = data.last_trained_at
        ? new Date(data.last_trained_at)
        : null;
      if (serverDate) {
        setLastTrained(serverDate);
      }
      return serverDate;
    } catch (error) {
      console.error("Failed to fetch model status", error);
      return null;
    }
  };

  useEffect(() => {
    fetchStatus();
    return () => stopPolling();
  }, [tenantId]);

  const stopPolling = () => {
    if (pollInterval.current) {
      clearInterval(pollInterval.current);
      pollInterval.current = null;
    }
  };

  const handleTrain = async () => {
    setIsTraining(true);
    setStatus("training");

    // Capture start time (if null, use 0)
    const startTime = lastTrained ? lastTrained.getTime() : 0;
    console.log("🏁 Training Started. Baseline Time:", startTime);

    try {
      await api.post(`/api/admin/train-models/${tenantId}/`);

      toast.info(`Training Started for ${tenantName}`, {
        description: "Waiting for completion signal...",
      });

      // Poll every 2 seconds
      pollInterval.current = setInterval(async () => {
        const newTime = await fetchStatus();
        const newTimeMs = newTime ? newTime.getTime() : 0;

        console.log(
          `🔄 Polling... Server Time: ${newTimeMs} vs Baseline: ${startTime}`,
        );

        // Check if server time is NEWER than baseline
        if (newTimeMs > startTime) {
          console.log("✅ Training Finished!");
          stopPolling();
          setIsTraining(false);
          setStatus("complete");
          toast.success("Training Complete!", {
            description: "The new model is live and active.",
          });
          setTimeout(() => setStatus("idle"), 5000);
        }
      }, 2000);
    } catch (error) {
      console.error(error);
      toast.error("Trigger Failed");
      setIsTraining(false);
      setStatus("idle");
      stopPolling();
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(date);
  };

  return (
    <Card className="border-l-4 border-l-blue-500 bg-muted/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <BrainCircuit
                className={`h-5 w-5 ${isTraining ? "text-blue-600 animate-pulse" : "text-blue-600"}`}
              />
              AI Model Status
            </CardTitle>
            <CardDescription>
              {isTraining
                ? "Processing sales data & optimizing forecasts..."
                : `Manage the forecasting engine for ${tenantName}.`}
            </CardDescription>
          </div>

          <div className="flex items-center gap-3">
            {lastTrained && (
              <div className="flex flex-col items-end text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  {status === "complete" ? (
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                  ) : (
                    <Clock className="h-3 w-3" />
                  )}
                  {status === "complete"
                    ? "Updated Just Now"
                    : `Last: ${formatDate(lastTrained)}`}
                </span>
              </div>
            )}

            <Button
              onClick={handleTrain}
              disabled={isTraining}
              size="sm"
              className={`min-w-[140px] text-white transition-all ${
                status === "complete"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {isTraining ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Training...
                </>
              ) : status === "complete" ? (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Done
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" /> Retrain Model
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
