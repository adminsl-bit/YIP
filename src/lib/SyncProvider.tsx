import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { subscribeToQueue, type QueuedMutation } from './offlineQueue';
import { processQueue } from './syncManager';

interface SyncContextValue {
  pendingMutations: QueuedMutation[];
}

const SyncContext = createContext<SyncContextValue>({ pendingMutations: [] });

export const useSyncQueue = () => useContext(SyncContext);

export const SyncProvider = ({ children }: { children: ReactNode }) => {
  const isOnline = useOnlineStatus();
  const [pendingMutations, setPendingMutations] = useState<QueuedMutation[]>([]);

  useEffect(() => subscribeToQueue(setPendingMutations), []);

  useEffect(() => {
    if (isOnline) {
      processQueue();
    }
  }, [isOnline]);

  return <SyncContext.Provider value={{ pendingMutations }}>{children}</SyncContext.Provider>;
};
