import api from '@/lib/api';

// ✅ Define the shape of a single top product
export interface TopProduct {
  product__name: string;
  total_sold: number;
  total_revenue: number;
}

export interface DashboardStats {
  revenue: { value: number; trend: number };
  profit: { value: number; trend: number };
  low_stock: number;
  product_count: number;
  layout_config: string[];
  
  // ✅ Add this line so TypeScript knows it exists
  top_products: TopProduct[]; 
}

export const salesService = {
  async getDashboardStats() {
    const response = await api.get<DashboardStats>('/api/sales/dashboard-stats/');
    return response.data;
  }
};