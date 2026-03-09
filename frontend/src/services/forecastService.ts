import api from '@/lib/api';

// 1. Explicitly export the Alert interface so the Page can use it
export interface AnomalyAlert {
  id: number;
  product_name: string;
  product_sku: string;
  anomaly_type: 'ghost_stock' | 'velocity_spike' | 'shrinkage'; // Added shrinkage
  severity: 'high' | 'medium' | 'low';
  description: string;
  detected_at: string;
}

export interface ForecastItem {
  product_name: string;
  product_sku: string;
  current_stock: number;
  predicted_quantity: number;
  reasoning: string;
  recommended_action: string;
}

export interface DashboardData {
  summary: {
    total_alerts: number;
    critical_alerts: number;
    ghost_stock: number;
    velocity_spikes: number;
  };
  forecasts: ForecastItem[];
  alerts: AnomalyAlert[];
}

export const forecastService = {
  // ✅ Updated to allow returning the locked state
  async getDashboard(): Promise<DashboardData | { isLocked: true; message: string }> {
    try {
      const response = await api.get('/api/forecasts/dashboard/');
      return response.data;
    } catch (error: any) {
      // ✅ Catch the billing lock specifically
      if (error.response?.status === 403) {
        return { 
          isLocked: true, 
          message: error.response.data?.detail || "You need to upgrade to access this feature."
        };
      }
      // Throw actual network/server errors
      throw error;
    }
  }
};