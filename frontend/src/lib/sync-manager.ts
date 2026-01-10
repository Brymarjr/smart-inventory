import { db } from './db';
import api from './api';
import { v4 as uuidv4 } from 'uuid';

const DEVICE_ID_KEY = 'device_id';

// ✅ FIX: Logic rewritten to satisfy TypeScript strict null checks
export const getDeviceId = (): string => {
  const storedId = localStorage.getItem(DEVICE_ID_KEY);
  
  if (storedId) {
    return storedId;
  }

  // If no ID exists, generate one, save it, and return it.
  const newId = uuidv4();
  localStorage.setItem(DEVICE_ID_KEY, newId);
  return newId;
};

// 2. PULL: Download updates from Server -> Local DB
export const pullData = async () => {
  try {
    // Get last sync time
    const meta = await db.meta.get('last_sync');
    const lastSync = meta?.value || null;
    const deviceId = getDeviceId();

    // Call Backend Download View
    const response = await api.get('/api/sync/download/', {
      params: { 
        device_id: deviceId, 
        last_sync: lastSync 
      }
    });

    const { data, synced_at, has_more } = response.data;

    // Save to Local DB (Bulk Put is faster)
    await db.transaction('rw', db.products, db.categories, db.customers, db.meta, async () => {
      
      // ✅ We check for data existence before putting
      if (data.product && Array.isArray(data.product)) {
        await db.products.bulkPut(data.product);
      }
      if (data.category && Array.isArray(data.category)) {
        await db.categories.bulkPut(data.category);
      }
      // Add other models as needed

      // Update timestamp
      await db.meta.put({ key: 'last_sync', value: synced_at });
    });

    return { success: true, hasMore: has_more };
  } catch (error) {
    console.error("Pull Failed:", error);
    return { success: false, error };
  }
};

// 3. PUSH: Upload Local Changes -> Server
export const pushData = async () => {
  try {
    // Get all pending items
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

    // Call Backend Upload View
    await api.post('/api/sync/upload/', payload);

    // If success, clear the queue!
    const idsToDelete = pendingItems.map(i => i.id as number);
    await db.syncQueue.bulkDelete(idsToDelete);

    return { success: true, count: pendingItems.length };

  } catch (error) {
    console.error("Push Failed:", error);
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
  
  // Try to push immediately if online
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    pushData(); 
  }
};