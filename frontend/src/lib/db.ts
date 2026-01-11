import Dexie, { Table } from 'dexie';

// Define Interfaces
export interface Product {
  id: number;
  name: string;
  quantity: number;
  price: number;
  sku?: string;
  category_id?: number;
  updated_at?: string;
}

export interface Category {
  id: number;
  name: string;
}

export interface Sale {
  id?: number;
  tmp_id?: string;
  reference?: string;
  customer_name?: string;
  total_amount: number;
  payment_method: string;
  created_at: string;
}

export interface SaleItem {
  id?: number;
  sale_tmp_id?: string;
  product_id: number;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface SyncQueueItem {
  id?: number;
  client_change_id: string;
  model_name: string;
  action: 'create' | 'update' | 'delete';
  payload: any;
  created_at: number;
  retry_count?: number;
}

export interface MetaItem {
  key: string;
  value: any;
}

// Database Class
export class SmartInventoryDB extends Dexie {
  products!: Table<Product, number>;
  categories!: Table<Category, number>;
  sales!: Table<Sale, number>;          // ✅ Added
  saleItems!: Table<SaleItem, number>;  // ✅ Added
  syncQueue!: Table<SyncQueueItem, number>;
  meta!: Table<MetaItem, string>;

  constructor() {
    super('SmartInventoryDB');
    this.version(1).stores({
      products: '++id, name, sku, category_id',
      categories: '++id, name',
      sales: '++id, tmp_id, created_at',       // ✅ Added schema
      saleItems: '++id, sale_tmp_id',           // ✅ Added schema
      syncQueue: '++id, created_at',
      meta: 'key' // Key-value store
    });
  }
}

export const db = new SmartInventoryDB();