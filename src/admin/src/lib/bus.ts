/* Pub/sub for signals that cross the component tree (ported from Giga Images' lib/bus.ts). A bus carries requests and
 * notices, never state: anything a component renders lives in the store. */

export type BusPayload = unknown;
type Handler = (payload: BusPayload) => void;

const topics = new Map<string, Set<Handler>>();

export function on(topic: string, fn: Handler): () => void {
  if (!topics.has(topic)) topics.set(topic, new Set());
  topics.get(topic)?.add(fn);
  return () => topics.get(topic)?.delete(fn);
}

export function emit(topic: string, payload?: BusPayload): void {
  const subs = topics.get(topic);
  if (!subs) return;
  for (const fn of subs) {
    try {
      fn(payload);
    } catch (err) {
      console.error(`bus handler failed on "${topic}":`, err);
    }
  }
}
