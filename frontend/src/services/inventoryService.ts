import api from '@/lib/api';

export interface Product {
  id: number;
  name: string;
  sku: string;
  quantity: number;
  price: string;
  category_name?: string; // Optional, based on your serializer
  supplier_name?: string; // Optional
}

export interface StockAdjustmentPayload {
  new_total?: number;       // Option A: Set exact number (e.g. "Count is now 5")
  quantity_change?: number; // Option B: Add/Subtract (e.g. "Add 5")
  reason: 'restock' | 'damage' | 'theft' | 'correction' | 'return';
  note?: string;
}

export const inventoryService = {
  // Get all products
  async getProducts() {
    const response = await api.get('/api/products/');
    return response.data; 
  },

  // Create a product
  async createProduct(data: any) {
    const response = await api.post('/api/products/', data);
    return response.data;
  },

  // Update a product
  async updateProduct(id: number, data: any) {
    const response = await api.patch(`/api/products/${id}/`, data);
    return response.data;
  },

  // Delete a product
  async deleteProduct(id: number) {
    const response = await api.delete(`/api/products/${id}/`);
    return response.data;
  },

  // THE NEW FEATURE: Adjust Stock
  async adjustStock(productId: number, payload: StockAdjustmentPayload) {
    const response = await api.post(`/api/products/${productId}/adjust-stock/`, payload);
    return response.data;
  },

  async archiveProduct(id: number, payload: { reason: string; note: string }) {
    // Calls the custom action /api/products/{id}/archive/
    const response = await api.post(`/api/products/${id}/archive/`, payload);
    return response.data;
  },

  async restoreProduct(id: number) {
    const response = await api.post(`/api/products/${id}/restore/`);
    return response.data;
  },
  
};