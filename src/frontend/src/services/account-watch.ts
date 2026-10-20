import { api } from "./api";
import { AccountWatchSchema, type WatchEntry } from "./schemas/watch-schema";

/** The account's watch entries (`63` sections 3.2 and 3.3): `GET /api/account/watch` through the existing
 *  `/api/account` pass, answering the account's rows newest first. This is the browser runtime's source of watch
 *  truth while a session is held - `library-local.ts` computes the Continue selection, the history pages and the row
 *  marks from it on `src/shared/watch`, the account standing in for the IndexedDB store `61` wave 2 read. The reader
 *  is a named seam so tests inject the account's answer without a wire. */

export type AccountWatchReader = (signal?: AbortSignal) => Promise<WatchEntry[]>;

function defaultReader(signal?: AbortSignal): Promise<WatchEntry[]> {
  return api("/api/account/watch", AccountWatchSchema, { signal, area: "Catalog" }).then((answer) => answer.entries);
}

let reader: AccountWatchReader = defaultReader;

/** The one account read, used at each Library join - never cached: the account is the live home. */
export function readAccountWatch(signal?: AbortSignal): Promise<WatchEntry[]> {
  return reader(signal);
}

/** Points the reader at an injected one (tests); null restores the account call. */
export function setAccountWatchReader(next: AccountWatchReader | null): void {
  reader = next ?? defaultReader;
}
