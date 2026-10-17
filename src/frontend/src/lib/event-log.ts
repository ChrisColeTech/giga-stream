import type { EventArea, EventRow } from "@/types/events";

export const EVENT_LOG_LIMIT = 200;

export type EventInput = Omit<EventRow, "id" | "at"> & { readonly id?: string; readonly at?: number };

export function appendEvent(rows: readonly EventRow[], input: EventInput, now = Date.now()): readonly EventRow[] {
  const row: EventRow = {
    ...input,
    id: input.id ?? `event-${now}-${rows.length}`,
    at: input.at ?? now,
  };
  return [...rows, row].slice(-EVENT_LOG_LIMIT);
}

export function restEvent(
  method: string,
  status: number | "aborted" | "invalid" | "unreachable",
  elapsedMs: number,
  area: EventArea,
): EventInput {
  const failed = status === "invalid" || status === "unreachable" || (typeof status === "number" && status >= 400);
  return {
    tone: failed ? "warn" : "info",
    area,
    sentence: `${method.toUpperCase()} fileserver ${status} in ${Math.max(0, Math.round(elapsedMs))} ms.`,
  };
}
