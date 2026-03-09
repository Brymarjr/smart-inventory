import { useState, useEffect, useRef } from 'react';
import { pullData, pushData, getDeviceId } from '@/lib/sync-manager';
import { db } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';

export function useSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  
  // ✅ NEW: A "Hard Lock" that persists across renders
  const syncLock = useRef(false);

  const pendingCount = useLiveQuery(() => db.syncQueue.count()) || 0;

  const triggerSync = async () => {
    // 1. Check the Hard Lock immediately
    if (syncLock.current) {
        console.log("🔒 Sync already in progress (Locked). Skipping...");
        return;
    }

    const token = localStorage.getItem('access_token');
    if (!token) return;

    // 2. Set Lock
    syncLock.current = true;
    setIsSyncing(true);

    try {
        const pushResult = await pushData();
        // ✅ Stop if Billing Limit reached
        if (pushResult?.halted) {
            setIsSyncing(false);
            return;
        }

        const pullResult = await pullData();
        // ✅ Stop if Billing Limit reached
        if (pullResult?.halted) {
            setIsSyncing(false);
            return;
        }
        
        const meta = await db.meta.get('last_sync');
        setLastSyncTime(meta?.value);
        
    } catch(err) {
        console.error("Sync error:", err);
    } finally {
        // 3. Release Lock
        syncLock.current = false;
        setIsSyncing(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    const onOnline = () => triggerSync();
    window.addEventListener('online', onOnline);
    
    // Trigger immediately on mount
    triggerSync();

    return () => window.removeEventListener('online', onOnline);
  }, []);

  return { isSyncing, pendingCount, lastSyncTime, triggerSync };
}