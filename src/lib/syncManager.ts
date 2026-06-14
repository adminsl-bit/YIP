import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { getQueue, removeFromQueue, type QueuedMutation } from './offlineQueue';

let processing = false;

const runMutation = async (mutation: QueuedMutation): Promise<{ error: { message: string } | null }> => {
  if (mutation.type === 'insert') {
    const { error } = await (supabase.from(mutation.table as never) as any).insert(mutation.payload);
    return { error };
  }
  if (mutation.type === 'update') {
    let query = (supabase.from(mutation.table as never) as any).update(mutation.payload);
    Object.entries(mutation.match ?? {}).forEach(([key, value]) => {
      query = query.eq(key, value);
    });
    const { error } = await query;
    return { error };
  }
  let query = (supabase.from(mutation.table as never) as any).delete();
  Object.entries(mutation.match ?? {}).forEach(([key, value]) => {
    query = query.eq(key, value);
  });
  const { error } = await query;
  return { error };
};

/**
 * Replays queued offline mutations in order. Stops (without dropping the
 * remaining queue) the moment we detect we're offline again, so a partial
 * sync can resume on the next `online` event.
 */
export const processQueue = async (): Promise<void> => {
  if (processing) return;
  processing = true;
  try {
    const queue = await getQueue();
    for (const mutation of queue) {
      if (!navigator.onLine) break;
      const { error } = await runMutation(mutation);
      if (!error) {
        await removeFromQueue(mutation.id);
        continue;
      }
      if (!navigator.onLine) break;
      // Online but rejected (e.g. RLS/constraint, session closed) — drop it
      // and let the user know rather than retrying forever.
      await removeFromQueue(mutation.id);
      toast.error(`Couldn't sync: ${mutation.description}`, {
        description: error.message,
      });
    }
  } finally {
    processing = false;
  }
};
