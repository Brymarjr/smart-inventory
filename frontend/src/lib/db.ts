// src/lib/db.ts
import Dexie, { Table } from 'dexie';

// 1. Define Interfaces (What our data looks like locally)
export interface LocalProduct {
  id: number; // Server ID
  name: string;
  sku: string;
  price: number;
  quantity: number;
  category_id?: number;
  updated_at: string; // Needed for conflict detection
}

export interface LocalCategory {
  id: number;
  name: string;
}

export interface LocalCustomer {
  id: number;
  name: string;
  email?: string;
  phone?: string;
}

// 2. The "Outbox" for Offline Actions
// When offline, we save actions here instead of calling the API directly.
export interface SyncQueueItem {
  id?: number; // Auto-increment local ID
  client_change_id: string; // UUID to prevent duplicates
  model_name: string; // e.g. 'sales.Sale'
  action: 'create' | 'update' | 'delete';
  payload: any; // The JSON data (like the sale details)
  created_at: number; // Timestamp
}

// 3. The Database Class
class SmartInventoryDB extends Dexie {
  products!: Table<LocalProduct>;
  categories!: Table<LocalCategory>;
  customers!: Table<LocalCustomer>;
  syncQueue!: Table<SyncQueueItem>; // The "Outbox"
  meta!: Table<{ key: string; value: any }>; // Store things like 'last_sync_timestamp'

  constructor() {
    super('SmartInventoryDB');
    
    // Define Schema
    // ++id means auto-increment. &id means unique index.
    this.version(1).stores({
      products: '&id, sku, category_id, name', // Index for fast searching
      categories: '&id, name',
      customers: '&id, name, phone',
      syncQueue: '++id, created_at', // Ordered by creation time
      meta: '&key' 
    });
  }
}

export const db = new SmartInventoryDB();