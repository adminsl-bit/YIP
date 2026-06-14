import { CloudUpload } from 'lucide-react';
import { useSyncQueue } from '@/lib/SyncProvider';

export const PendingSyncBadge = () => {
  const { pendingMutations } = useSyncQueue();

  if (pendingMutations.length === 0) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 right-4 z-[90] flex items-center gap-2 rounded-full bg-primary px-3 py-2 text-xs font-bold text-white shadow-lg">
      <CloudUpload className="h-4 w-4 animate-pulse" />
      {pendingMutations.length} pending sync
    </div>
  );
};
