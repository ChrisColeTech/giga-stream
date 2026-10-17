import type { ItemRef } from "@/types/library";
import { api } from "./api";
import { ClearedWatchSchema, RemovedWatchSchema, WatchWriteAnswerSchema, WatchWriteSchema } from "./schemas/watch-schema";
import type { z } from "zod";

const part = (value: string): string => encodeURIComponent(value);

export type WatchWrite = z.input<typeof WatchWriteSchema>;

/** Records progress. A periodic write is quiet (no Events row on success); `keepalive` lets the write made as the
 *  window hides or closes finish after the page is gone. */
export function writeWatch(write: WatchWrite, options: { readonly keepalive?: boolean } = {}) {
  return api("/api/watch", WatchWriteAnswerSchema, {
    method: "PUT", body: write, area: "Playback", quiet: true, keepalive: options.keepalive === true,
  });
}

export function removeWatch(watchId: string) {
  return api(`/api/watch/${part(watchId)}`, RemovedWatchSchema, { method: "DELETE", area: "Catalog" });
}

export function clearWatch() {
  return api("/api/watch", ClearedWatchSchema, { method: "DELETE", area: "Catalog" });
}

export type { ItemRef };
