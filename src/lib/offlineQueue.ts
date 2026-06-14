import { get, set } from 'idb-keyval';

export interface QueuedMutation {
  id: string; // crypto.randomUUID() — also the row's PK for optimistic dedup
  table: string;
  type: 'insert' | 'update' | 'delete';
  payload: Record<string, unknown>;
  match?: Record<string, unknown>; // row matcher, required for updates/deletes
  description: string; // human-readable, shown in the pending-sync UI
  createdAt: number;
}

const QUEUE_KEY = 'yip-offline-mutation-queue';

type Listener = (queue: QueuedMutation[]) => void;
const listeners = new Set<Listener>();

const notify = (queue: QueuedMutation[]) => {
  listeners.forEach((listener) => listener(queue));
};

export const getQueue = async (): Promise<QueuedMutation[]> => {
  return (await get<QueuedMutation[]>(QUEUE_KEY)) ?? [];
};

export const enqueueMutation = async (
  mutation: Omit<QueuedMutation, 'id' | 'createdAt'> & { id?: string }
): Promise<QueuedMutation> => {
  const queue = await getQueue();
  const queued: QueuedMutation = {
    ...mutation,
    id: mutation.id ?? crypto.randomUUID(),
    createdAt: Date.now(),
  };
  const next = [...queue, queued];
  await set(QUEUE_KEY, next);
  notify(next);
  return queued;
};

export const removeFromQueue = async (id: string): Promise<void> => {
  const queue = await getQueue();
  const next = queue.filter((m) => m.id !== id);
  await set(QUEUE_KEY, next);
  notify(next);
};

export const subscribeToQueue = (listener: Listener): (() => void) => {
  listeners.add(listener);
  getQueue().then(listener);
  return () => listeners.delete(listener);
};
