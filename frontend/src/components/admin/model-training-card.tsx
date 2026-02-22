'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, BrainCircuit, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export function ModelTrainingCard() {
  const [isLoading, setIsLoading] = useState(false);
  const [lastTrain, setLastTrain] = useState<string | null>(null);

  const handleTrain = async () => {
    setIsLoading(true);
    try {
      // ✅ Call the new endpoint
      await api.post('/api/inventory/admin/train-models/');
      
      toast.success('Training Complete', {
        description: 'Demand forecasting models updated with latest sales data.',
      });
      setLastTrain(new Date().toLocaleString());
      
    } catch (error) {
      console.error(error);
      toast.error('Training Failed', {
        description: 'Check server logs for details.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-l-4 border-l-purple-500 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <BrainCircuit className="h-6 w-6 text-purple-600" />
                <CardTitle>AI Model Training</CardTitle>
            </div>
            {lastTrain && (
                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Updated: {lastTrain}
                </Badge>
            )}
        </div>
        <CardDescription>
          Manually trigger the Machine Learning engine to re-analyze sales patterns and update forecast accuracy.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between bg-slate-50 p-4 rounded-lg border">
            <div className="space-y-1">
                <p className="text-sm font-medium">Demand Forecasting Engine</p>
                <p className="text-xs text-muted-foreground">Status: <span className="text-green-600 font-medium">Idle</span> • Last run: Automatic (Daily)</p>
            </div>
            
            <Button 
                onClick={handleTrain} 
                disabled={isLoading}
                className="bg-purple-600 hover:bg-purple-700 text-white min-w-[140px]"
            >
                {isLoading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Training...
                    </>
                ) : (
                    "Start Training"
                )}
            </Button>
        </div>
        
        <div className="mt-4 flex items-start gap-2 text-xs text-amber-600 bg-amber-50 p-2 rounded">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <p>Note: Training may slow down the server for 10-20 seconds. Recommended to run during low-traffic periods.</p>
        </div>
      </CardContent>
    </Card>
  );
}