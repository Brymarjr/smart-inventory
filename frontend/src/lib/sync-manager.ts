import { db } from './db';
import api from './api';
import { v4 as uuidv4 } from 'uuid';

const DEVICE_ID_KEY = 'device_id';

export const getDeviceId = (): string => {
  if (typeof window === 'undefined') return 'server-side';
  const storedId = localStorage.getItem(DEVICE_ID_KEY);
  if (storedId) return storedId;

  const newId = uuidv4();
  localStorage.setItem(DEVICE_ID_KEY, newId);
  return newId;
};

// Helper: Debugs and retrieves headers
const getAuthHeaders = () => {
    if (typeof window === 'undefined') return {};
    
    // 🔍 DEBUG: Check what keys you actually have
    console.log("🔍 LocalStorage Keys:", Object.keys(localStorage));
    
    // Try the common names
    const token = localStorage.getItem('access_token') || localStorage.getItem('accessToken') || localStorage.getItem('token');
    
    if (!token) {
        console.error("❌ getAuthHeaders: NO TOKEN FOUND! You appear logged out or using cookies.");
        return {};
    }
    
    console.log("✅ getAuthHeaders: Token found (length " + token.length + ")");
    return { Authorization: `Bearer ${token}` };
};

// 2. PULL: Download updates
export const pullData = async () => {
  try {
    // 1. Safety Check
    const headers = getAuthHeaders();
    if (!headers.Authorization) {
        console.warn("⏸️ Sync Pull Skipped: No Auth Token available.");
        return { success: false, error: "No token" };
    }

    const meta = await db.meta.get('last_sync');
    const lastSync = meta?.value || null;
    const deviceId = getDeviceId();

    console.log("⬇️ Starting Sync Pull...");

    // 2. Request
    const response = await api.get('/api/sync/download/', {
      params: { 
        device_id: deviceId, 
        last_sync: lastSync 
      },
      headers: headers // Explicitly attach the found token
    });

    const { data, synced_at, has_more } = response.data;

    // 3. Save to DB (Using array [] to fix arguments error)
    await db.transaction('rw', [db.products, db.categories, db.sales, db.saleItems, db.meta], async () => {
      
      if (data?.products && Array.isArray(data.products)) await db.products.bulkPut(data.products);
      if (data?.categories && Array.isArray(data.categories)) await db.categories.bulkPut(data.categories);
      
      if (data?.product && Array.isArray(data.product)) await db.products.bulkPut(data.product);
      if (data?.category && Array.isArray(data.category)) await db.categories.bulkPut(data.category);

      if (data?.sales && Array.isArray(data.sales)) await db.sales.bulkPut(data.sales);
      if (data?.saleitems && Array.isArray(data.saleitems)) await db.saleItems.bulkPut(data.saleitems);

      await db.meta.put({ key: 'last_sync', value: synced_at });
    });

    console.log(`✅ Sync Pull Success: ${synced_at}`);
    
    if (has_more) {
        await pullData();
    }

    return { success: true, hasMore: has_more };
  } catch (error) {
    console.error("❌ Sync Pull Failed:", error);
    return { success: false, error };
  }
};

// 3. PUSH: Upload Local Changes
export const pushData = async () => {
  try {
    const headers = getAuthHeaders();
    if (!headers.Authorization) return { success: false, error: "No token" };

    const pendingItems = await db.syncQueue.toArray();
    if (pendingItems.length === 0) return { success: true, count: 0 };

    const payload = {
      device_id: getDeviceId(),
      client_ops: pendingItems.map(item => ({
        client_change_id: item.client_change_id,
        model_name: item.model_name,
        action: item.action,
        payload: item.payload
      }))
    };

    await api.post('/api/sync/upload/', payload, {
        headers: headers
    });

    const idsToDelete = pendingItems.map(i => i.id as number);
    await db.syncQueue.bulkDelete(idsToDelete);

    console.log(`✅ Pushed ${pendingItems.length} changes to server.`);
    return { success: true, count: pendingItems.length };

  } catch (error) {
    console.error("❌ Push Failed:", error);
    return { success: false, error };
  }
};

// 4. QUEUE: Helper to save an action offline
export const queueOperation = async (
  model: string, 
  action: 'create' | 'update' | 'delete', 
  payload: any
) => {
  await db.syncQueue.add({
    client_change_id: uuidv4(),
    model_name: model,
    action,
    payload,
    created_at: Date.now()
  });
  
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    pushData().catch(err => console.warn("Background push failed")); 
  }
};