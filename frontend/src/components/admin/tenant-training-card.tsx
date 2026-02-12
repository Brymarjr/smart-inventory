'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, BrainCircuit, Play, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface TenantTrainingCardProps {
  tenantId: string;
  tenantName: string;
}

export function TenantTrainingCard({ tenantId, tenantName }: TenantTrainingCardProps) {
  const [isTraining, setIsTraining] = useState(false);
  const [lastTrained, setLastTrained] = useState<string | null>(null);

  const handleTrain = async () => {
    setIsTraining(true);
    try {
      await api.post(`/api/admin/train-models/${tenantId}/`);
      
      toast.success(`Training Started for ${tenantName}`, {
        description: "The AI is processing sales data in the background."
      });
      
      // ✅ Capture timestamp on success
      setLastTrained(new Date().toLocaleTimeString());
      
    } catch (error) {
      console.error(error);
      toast.error("Training Failed", { description: "Check server logs." });
    } finally {
      setIsTraining(false);
    }
  };

  return (
    <Card className="border-l-4 border-l-blue-500 bg-slate-50/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
            <div className="space-y-1">
                <CardTitle className="text-base flex items-center gap-2">
                    <BrainCircuit className="h-5 w-5 text-blue-600" />
                    AI Model Status
                </CardTitle>
                <CardDescription>
                    Manage the forecasting engine for <strong>{tenantName}</strong>.
                </CardDescription>
            </div>
            
            <div className="flex items-center gap-3">
                {/* ✅ Added Last Run Badge */}
                {lastTrained && (
                    <span className="text-xs text-muted-foreground flex items-center bg-white px-2 py-1 rounded border animate-in fade-in slide-in-from-right-4">
                        <CheckCircle2 className="h-3 w-3 text-green-500 mr-1" />
                        Last run: {lastTrained}
                    </span>
                )}

                <Button 
                    onClick={handleTrain} 
                    disabled={isTraining}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                    {isTraining ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
                    ) : (
                        <><Play className="mr-2 h-4 w-4" /> Retrain Model</>
                    )}
                </Button>
            </div>
        </div>
      </CardHeader>
    </Card>
  );
}