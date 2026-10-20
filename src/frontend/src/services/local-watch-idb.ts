import { entryIdentity, type WatchEntry } from "@giga/watch/entry";
import { useAppStore } from "@/store/app-store";
import { WatchEntrySchema } from "@/services/schemas/watch-schema";

/** The IndexedDB conversation of the browser runtime's local watch history (`61` section 2.5): the structural
 *  shapes the store talks to, the promise helpers, the open with its upgrade, and the two entry cores - the real
 *  store and the in-memory one a failed open or write degrades to for the session. Shapes are structural so a test
 *  injects plain objects and the browser's real objects fit without a single assertion. */

export const WATCH_DATABASE_NAME = "giga";
export const WATCH_DATABASE_VERSION = 1;
export const WATCH_STORE_NAME = "watch";

/** The slice of IndexedDB the store uses; the handlers name their event, which is what makes the browser's own
 *  handler types assignable under this TypeScript. */
export type IdbRequestLike<T> = {
  readonly result: T;
  readonly error: DOMException | null;
  onsuccess: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
};
export type IdbStoreLike = {
  getAll(): IdbRequestLike<unknown[]>;
  put(value: WatchEntry, key: string): IdbRequestLike<unknown>;
  delete(key: string): IdbRequestLike<unknown>;
  clear(): IdbRequestLike<unknown>;
};
export type IdbTransactionLike = {
  objectStore(name: string): IdbStoreLike;
  readonly error: DOMException | null;
  oncomplete: ((event: Event) => void) | null;
  onabort: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
};
export type IdbDatabaseLike = {
  readonly objectStoreNames: { readonly contains: (name: string) => boolean };
  createObjectStore(name: string): IdbStoreLike;
  transaction(stores: readonly string[], mode: "readonly" | "readwrite"): IdbTransactionLike;
};
export type IdbOpenRequestLike = IdbRequestLike<IdbDatabaseLike> & {
  onupgradeneeded: ((event: IDBVersionChangeEvent) => void) | null;
  onblocked: ((event: IDBVersionChangeEvent) => void) | null;
};
export type IdbFactoryLike = { open(name: string, version: number): IdbOpenRequestLike };

export interface EntryCore {
  readonly load: () => Promise<WatchEntry[]>;
  readonly put: (entry: WatchEntry) => Promise<void>;
  readonly drop: (key: string) => Promise<void>;
  readonly clearAll: () => Promise<number>;
}

const spoken = new Set<string>();

/** One warning per reason per session, into the events drawer (`61` section 6: spoken once). */
export function speak(reason: string, detail: string): void {
  if (spoken.has(reason)) return;
  spoken.add(reason);
  useAppStore.getState().say(detail, "warn");
}

export const sentenceOfError = (error: unknown): string =>
  error instanceof Error ? error.message : "The watch store failed.";

function requestOf<T>(request: IdbRequestLike<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("The watch store request failed."));
  });
}

function completionOf(transaction: IdbTransactionLike): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("The watch store write was aborted."));
    transaction.onerror = () => reject(transaction.error ?? new Error("The watch store write failed."));
  });
}

/** Opens the database and creates the entry store on the first run's upgrade; a held open is a refusal, so the
 *  caller's degrade path takes over rather than the open waiting forever. */
export function openIdb(factory: IdbFactoryLike): Promise<IdbDatabaseLike> {
  return new Promise((resolve, reject) => {
    const request = factory.open(WATCH_DATABASE_NAME, WATCH_DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(WATCH_STORE_NAME)) {
        request.result.createObjectStore(WATCH_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("The watch store could not be opened."));
    request.onblocked = () => reject(new Error("The watch store is held by another window."));
  });
}

/** Stored rows are read back through the wire schema; one the schema refuses is dropped and named once. */
function validEntries(rows: unknown): WatchEntry[] {
  if (!Array.isArray(rows)) return [];
  const entries: WatchEntry[] = [];
  for (const row of rows) {
    const parsed = WatchEntrySchema.safeParse(row);
    if (parsed.success) entries.push(parsed.data);
    else speak("rows", "Some stored watch entries could not be read and were skipped.");
  }
  return entries;
}

/** The session's fallback: the same operations over an insertion-ordered map, nothing persisted. */
export function memoryCore(): EntryCore {
  const entries = new Map<string, WatchEntry>();
  return {
    load: async () => [...entries.values()],
    put: async (entry) => void entries.set(entryIdentity(entry), entry),
    drop: async (key) => void entries.delete(key),
    clearAll: async () => {
      const count = entries.size;
      entries.clear();
      return count;
    },
  };
}

export function idbCore(database: IdbDatabaseLike): EntryCore {
  const open = (mode: "readonly" | "readwrite"): { transaction: IdbTransactionLike; store: IdbStoreLike } => {
    const transaction = database.transaction([WATCH_STORE_NAME], mode);
    return { transaction, store: transaction.objectStore(WATCH_STORE_NAME) };
  };
  const writing = async (work: (store: IdbStoreLike) => void): Promise<void> => {
    const handle = open("readwrite");
    work(handle.store);
    await completionOf(handle.transaction);
  };
  return {
    load: async () => validEntries(await requestOf(open("readonly").store.getAll())),
    put: async (entry) => writing((store) => store.put(entry, entryIdentity(entry))),
    drop: async (key) => writing((store) => store.delete(key)),
    clearAll: async () => {
      const count = validEntries(await requestOf(open("readonly").store.getAll())).length;
      await writing((store) => store.clear());
      return count;
    },
  };
}
