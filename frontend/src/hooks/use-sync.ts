import { useState, useEffect } from 'react';
import { pullData, pushData, getDeviceId } from '@/lib/sync-manager'; // ✅ Import getDeviceId
import { db } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import api from '@/lib/api'; // ✅ Import API

export function useSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  const pendingCount = useLiveQuery(() => db.syncQueue.count()) || 0;

  const triggerSync = async () => {
    if (isSyncing) return;
    
    // 1. SAFETY: Don't sync if not logged in
    const token = localStorage.getItem('access_token');
    if (!token) return;

    setIsSyncing(true);
    try {
        const deviceId = getDeviceId();

        // 2. PUSH (Uploads changes & Registers Device)
        // Even if queue is empty, we might need to hit an endpoint to ensure device exists?
        // Actually, let's fix the Backend Download logic to be smarter (see Step 3 below) instead.
        await pushData();
        
        // 3. PULL (Downloads Data)
        await pullData();
        
        const meta = await db.meta.get('last_sync');
        setLastSyncTime(meta?.value);
        
    } catch(err) {
        console.error("Sync error:", err);
    } finally {
        setIsSyncing(false);
    }
  };

  useEffect(() => {
    // Only run if we have a token
    const token = localStorage.getItem('access_token');
    if (!token) return;

    const onOnline = () => triggerSync();
    window.addEventListener('online', onOnline);
    triggerSync();

    return () => window.removeEventListener('online', onOnline);
  }, []);

  return { isSyncing, pendingCount, lastSyncTime, triggerSync };
}