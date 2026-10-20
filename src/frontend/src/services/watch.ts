import { sessionInputs } from "@/store/selectors";
import type { ItemRef } from "@/types/library";
import { api } from "./api";
import { storeFor, type WatchBackends, type WatchStore } from "./persistence";
import {
  ClearedWatchSchema,
  RemovedWatchSchema,
  WatchWriteAnswerSchema,
} from "./schemas/watch-schema";
import type { ClearedWatch, RemovedWatch, WatchWrite, WatchWriteAnswer } from "./schemas/watch-schema";

export type { WatchWrite };

const part = (value: string): string => encodeURIComponent(value);

/** Signed out the watch domain answers none (`63` section 3.3) - the client never calls. These functions are typed
 *  to be reached only under a session; reaching one anyway is a broken guard, so it refuses loudly. */
const UNTRACKED = "Watch history is not kept while signed out.";

/** The one backend (`63` section 3.2): every write, removal and clear keeps the fileserver's single `/api/watch`
 *  contract, and the fileserver decides where the row lands - an Electron-marked request (the marker rides every
 *  request from the request layer, `services/api.ts`) writes its own `node:sqlite`; a browser call carries the
 *  account's bearer and is passed on to `/api/account/watch`. */
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
};

/** The resolver's answer for the session as it stands at this call; null means signed out. */
function store(): WatchStore {
  const resolved = storeFor("watch", BACKENDS, sessionInputs());
  if (resolved === null) throw new Error(UNTRACKED);
  return resolved;
}

/** Records progress. A periodic write is quiet (no Events row on success); `keepalive` lets the write made as the
 *  window hides or closes finish after the page is gone (on the desktop runtime). */
export function writeWatch(write: WatchWrite, options: { readonly keepalive?: boolean } = {}): Promise<WatchWriteAnswer> {
  return store().write(write, options);
}

export function removeWatch(watchId: string): Promise<RemovedWatch> {
  return store().remove(watchId);
}

export function clearWatch(): Promise<ClearedWatch> {
  return store().clear();
}

export type { ItemRef };
