import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export const OfflineBanner = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-center text-sm font-medium text-amber-950 shadow-md">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>You're offline — showing cached data. Changes will sync once you're back online.</span>
    </div>
  );
};
