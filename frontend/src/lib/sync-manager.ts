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

// 2. PULL: Download updates (Recursive Pagination)
export const pullData = async (page = 1): Promise<{ success: boolean; error?: any }> => {
  try {
    const headers = getAuthHeaders();
    
    // THE EMERGENCY BRAKE: If there is no token, throw a hard error 
    // instead of returning false. This stops any retry loops dead in their tracks.
    if (!headers.Authorization) {
      console.warn("Sync aborted: User is not fully authenticated yet.");
      return { success: false, error: "NO_TOKEN_ABORT" };
    }

    // Only read from DB on the first page
    let lastSync = null;
    if (page === 1) {
        const meta = await db.meta.get('last_sync');
        lastSync = meta?.value || null;
    }
    
    const deviceId = getDeviceId();
    console.log(`⬇️ Sync Pull: Page ${page}...`);

    const response = await api.get('/api/sync/download/', {
      params: { device_id: deviceId, last_sync: lastSync, page: page },
      headers: headers
    });

    const { data, synced_at, has_more } = response.data;

    // 3. Save to DB with SANITIZATION
    await db.transaction('rw', [db.products, db.categories, db.sales, db.saleItems, db.meta], async () => {
      
      const rawProducts = data?.product || data?.products || [];
      const rawCategories = data?.category || data?.categories || [];
      const rawSales = data?.sale || data?.sales || [];
      const rawSaleItems = data?.saleitem || data?.saleitems || [];

      // --- 1. Clean Products ---
      if (rawProducts.length > 0) {
          const cleanProducts = rawProducts.map((p: any) => {
              const clean: any = { ...p };
              if (!clean.sku || clean.sku.trim() === "") delete clean.sku; 
              clean.price = parseFloat(p.price) || 0;
              clean.quantity = parseInt(p.quantity) || 0;
              return clean;
          });
          await db.products.bulkPut(cleanProducts);
      }
      
      // --- 2. Clean Categories ---
      if (rawCategories.length > 0) {
          await db.categories.bulkPut(rawCategories);
      }

      // --- 3. Clean Sales ---
      if (rawSales.length > 0) {
          const cleanSales = rawSales.map((s: any) => ({
              ...s,
              total_amount: parseFloat(s.total_amount) || 0,
              // Ensure dates are strings for Dexie
              created_at: s.created_at ? new Date(s.created_at).toISOString() : new Date().toISOString()
          }));
          await db.sales.bulkPut(cleanSales);
      }

      // --- 4. Clean SaleItems (THE FIX FOR YOUR ERROR) ---
      if (rawSaleItems.length > 0) {
          const cleanItems = rawSaleItems.map((i: any) => ({
              ...i,
              quantity: parseInt(i.quantity) || 1,
              unit_price: parseFloat(i.unit_price) || 0,
              subtotal: parseFloat(i.subtotal) || 0,
              // Remove null IDs if they exist
              id: i.id ? i.id : undefined 
          }));
          console.log(`💾 Saving ${cleanItems.length} items...`);
          await db.saleItems.bulkPut(cleanItems);
      }

      // Only update the timestamp if we are DONE.
      if (!has_more) {
         await db.meta.put({ key: 'last_sync', value: synced_at });
         console.log(`✅ Sync Complete! Updated timestamp to: ${synced_at}`);
      }
    });

    // 4. Recursion
    if (has_more) {
        await new Promise(r => setTimeout(r, 50));
        return await pullData(page + 1); 
    }

    return { success: true };

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