import { supabase } from '@/integrations/supabase/client';
import { enqueueMutation } from './offlineQueue';

interface ExecuteOrQueueParams {
  table: string;
  type: 'insert' | 'update' | 'delete';
  payload: Record<string, unknown>;
  match?: Record<string, unknown>;
  description: string;
}

export interface ExecuteOrQueueResult {
  error: { message: string } | null;
  queued: boolean;
}

/**
 * Runs a Supabase insert/update immediately when online; when offline (or
 * the request fails because connectivity just dropped), queues it for the
 * sync manager to replay once back online.
 */
export const executeOrQueue = async ({
  table,
  type,
  payload,
  match,
  description,
}: ExecuteOrQueueParams): Promise<ExecuteOrQueueResult> => {
  if (!navigator.onLine) {
    await enqueueMutation({ table, type, payload, match, description });
    return { error: null, queued: true };
  }

  let error: { message: string } | null = null;
  if (type === 'insert') {
    const res = await (supabase.from(table as never) as any).insert(payload);
    error = res.error;
  } else if (type === 'update') {
    let query = (supabase.from(table as never) as any).update(payload);
    Object.entries(match ?? {}).forEach(([key, value]) => {
      query = query.eq(key, value);
    });
    const res = await query;
    error = res.error;
  } else {
    let query = (supabase.from(table as never) as any).delete();
    Object.entries(match ?? {}).forEach(([key, value]) => {
      query = query.eq(key, value);
    });
    const res = await query;
    error = res.error;
  }

  if (error) {
    if (!navigator.onLine) {
      await enqueueMutation({ table, type, payload, match, description });
      return { error: null, queued: true };
    }
    return { error, queued: false };
  }

  return { error: null, queued: false };
};
