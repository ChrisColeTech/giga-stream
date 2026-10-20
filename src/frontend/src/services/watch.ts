import type { ItemRef } from "@/types/library";
import { api } from "./api";
import { sharedLocalWatch } from "./local-watch";
import { storeFor, type WatchBackends } from "./persistence";
import {
  ClearedWatchSchema,
  RemovedWatchSchema,
  WatchWriteAnswerSchema,
} from "./schemas/watch-schema";
import type { ClearedWatch, RemovedWatch, WatchWrite, WatchWriteAnswer } from "./schemas/watch-schema";

export type { WatchWrite };

const part = (value: string): string => encodeURIComponent(value);

/** The two backends (`61` section 2.2). The server's is today's REST transport, byte for byte. The local one keeps the
 *  entries in IndexedDB through `local-watch.ts`; its `keepalive` is accepted and left unused, because an IndexedDB put
 *  is issued at once - the pagehide/visibilitychange flush still delivers without a server round trip. */
const BACKENDS: WatchBackends = {
  server: {
    write: (write, options, signal) => api("/api/watch", WatchWriteAnswerSchema, {
      method: "PUT", body: write, area: "Playback", quiet: true,
      keepalive: options?.keepalive === true, signal,
    }),
    remove: (watchId, signal) =>
      api(`/api/watch/${part(watchId)}`, RemovedWatchSchema, { method: "DELETE", area: "Catalog", signal }),
    clear: (signal) => api("/api/watch", ClearedWatchSchema, { method: "DELETE", area: "Catalog", signal }),
  },
  local: {
    write: async (write) => (await sharedLocalWatch()).write(write),
    remove: async (watchId) => (await sharedLocalWatch()).remove(watchId),
    clear: async () => (await sharedLocalWatch()).clear(),
  },
};

/** Records progress. A periodic write is quiet (no Events row on success); `keepalive` lets the write made as the
 *  window hides or closes finish after the page is gone (on the desktop runtime). */
export function writeWatch(write: WatchWrite, options: { readonly keepalive?: boolean } = {}): Promise<WatchWriteAnswer> {
  return storeFor("watch", BACKENDS).write(write, options);
}

export function removeWatch(watchId: string): Promise<RemovedWatch> {
  return storeFor("watch", BACKENDS).remove(watchId);
}

export function clearWatch(): Promise<ClearedWatch> {
  return storeFor("watch", BACKENDS).clear();
}

export type { ItemRef };
