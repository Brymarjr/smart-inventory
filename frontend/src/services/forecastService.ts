import api from '@/lib/api';

// 1. Explicitly export the Alert interface so the Page can use it
export interface AnomalyAlert {
  id: number;
  product_name: string;
  product_sku: string;
  anomaly_type: 'ghost_stock' | 'velocity_spike' | 'shrinkage'; 
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
  /**
   * Fetches dashboard data and ensures the structure is safe for the UI.
   * Prevents "Client-side exception" by filling in missing backend fields.
   */
  async getDashboard(): Promise<DashboardData | { isLocked: true; message: string }> {
    try {
      const response = await api.get('/api/forecasts/dashboard/');
      const rawData = response.data;

      // ✅ DATA NORMALIZATION (Preventing undefined crashes)
      // If the backend returns partial data, we provide safe defaults here
      const sanitizedData: DashboardData = {
        summary: {
          total_alerts: rawData?.summary?.total_alerts ?? 0,
          critical_alerts: rawData?.summary?.critical_alerts ?? 0,
          ghost_stock: rawData?.summary?.ghost_stock ?? 0,
          velocity_spikes: rawData?.summary?.velocity_spikes ?? 0,
        },
        forecasts: Array.isArray(rawData?.forecasts) ? rawData.forecasts : [],
        alerts: Array.isArray(rawData?.alerts) ? rawData.alerts : [],
      };

      return sanitizedData;
    } catch (error: any) {
      // ✅ Catch the billing lock specifically
      if (error.response?.status === 403) {
        return { 
          isLocked: true, 
          message: error.response.data?.detail || "You need to upgrade to access this feature."
        };
      }
      // Throw actual network/server errors to be caught by the UI catch block
      throw error;
    }
  }
};