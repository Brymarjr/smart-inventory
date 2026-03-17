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
    
    // Try the common names
    const token = localStorage.getItem('access_token') || localStorage.getItem('accessToken') || localStorage.getItem('token');
    
    if (!token) {
        console.error("❌ getAuthHeaders: NO TOKEN FOUND! You appear logged out or using cookies.");
        return {};
    }
    
    return { Authorization: `Bearer ${token}` };
};

// 2. PULL: Download updates (Recursive Pagination)
export const pullData = async (page = 1, passedLastSync: string | null = null): Promise<{ success: boolean; halted?: boolean; error?: any }> => {
  try {
    const headers = getAuthHeaders();
    
    // THE EMERGENCY BRAKE
    if (!headers.Authorization) {
      console.warn("Sync aborted: User is not fully authenticated yet.");
      return { success: false, error: "NO_TOKEN_ABORT" };
    }

    let lastSync = passedLastSync;
    if (page === 1) {
        lastSync = localStorage.getItem('last_sync_time');
    }
    
    const deviceId = getDeviceId();
    console.log(`⬇️ Sync Pull: Page ${page}... ${lastSync ? '(Delta Sync)' : '(Full Sync)'}`);

    const response = await api.get('/api/sync/download/', {
      params: { device_id: deviceId, last_sync: lastSync, page: page },
      headers: headers
    });

    // 👀 DEBUG: Let's see exactly what the backend gives us
    console.log(`👀 BACKEND RESPONSE DATA (Page ${page}):`, response.data);

    const { data, synced_at, has_more, next } = response.data;

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
              created_at: s.created_at ? new Date(s.created_at).toISOString() : new Date().toISOString()
          }));
          await db.sales.bulkPut(cleanSales);
      }

      // --- 4. Clean SaleItems ---
      if (rawSaleItems.length > 0) {
          const cleanItems = rawSaleItems.map((i: any) => ({
              ...i,
              quantity: parseInt(i.quantity) || 1,
              unit_price: parseFloat(i.unit_price) || 0,
              subtotal: parseFloat(i.subtotal) || 0,
              id: i.id ? i.id : undefined 
          }));
          await db.saleItems.bulkPut(cleanItems);
      }
    });

    // 4. Recursion or Finish
    // 👇 THE FIX: Bulletproof check for both `has_more` boolean AND Django's `next` URL
    const hasMorePages = has_more === true || !!next;

    if (hasMorePages) {
        await new Promise(r => setTimeout(r, 50));
        return await pullData(page + 1, lastSync); 
    } else {
        // WE ARE DONE! Save the timestamp so the next refresh skips everything
        const finalSyncTime = synced_at || new Date().toISOString();
        localStorage.setItem('last_sync_time', finalSyncTime);
        console.log(`✅ Sync Complete! Updated timestamp to: ${finalSyncTime}`);
        return { success: true };
    }

  } catch (error: any) {
    if (error.response?.status === 402 || error.response?.status === 403) {
      console.warn(`[SYNC HALTED] Billing Limit Reached: ${error.response.data?.detail}`);
      return { success: false, halted: true, error: error.response.data?.detail }; 
    }

    console.error("❌ Sync Pull Failed:", error);
    return { success: false, error };
  }
};

// 3. PUSH: Upload Local Changes
export const pushData = async (): Promise<{ success: boolean; count?: number; halted?: boolean; error?: any }> => {
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

  } catch (error: any) {
    // ✅ Catch Billing Limits Gracefully on Push too
    if (error.response?.status === 402 || error.response?.status === 403) {
      console.warn(`[SYNC HALTED] Billing Limit Reached on Push: ${error.response.data?.detail}`);
      return { success: false, halted: true, error: error.response.data?.detail }; 
    }

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