import { SEARCH_DEBOUNCE_MS } from "@/lib/live-constants";
import { collectionOf, type LibraryQuery } from "@/lib/library-query";
import type { LibraryItem, LibraryPage } from "@/types/library";
import { api } from "./api";
import { decoratedLibraryPage, readLocalContinue, readLocalHistory } from "./library-local";
import { onDesktopRuntime } from "./persistence";
import {
  CollectionLibraryPageSchema,
  ContinuePageSchema,
  LibraryPageSchema,
  LibraryRefreshSchema,
} from "./schemas/library-schema";

export interface LibrarySearchSeams {
  readonly read: typeof readLibrary;
  readonly schedule: (callback: () => void, delay: number) => number;
  readonly cancel: (handle: number) => void;
}

const SEAMS: LibrarySearchSeams = {
  read: readLibrary,
  schedule: (callback, delay) => window.setTimeout(callback, delay),
  cancel: (handle) => window.clearTimeout(handle),
};

export class LibrarySearchSession {
  private controller: AbortController | null = null;
  private timer: number | null = null;
  private generation = 0;
  private readonly onResult: (answer: Awaited<ReturnType<typeof readLibrary>>) => void;
  private readonly onRefusal: (error: unknown) => void;
  private readonly seams: LibrarySearchSeams;

  constructor(
    onResult: (answer: Awaited<ReturnType<typeof readLibrary>>) => void,
    onRefusal: (error: unknown) => void,
    seams: LibrarySearchSeams = SEAMS,
  ) {
    this.onResult = onResult;
    this.onRefusal = onRefusal;
    this.seams = seams;
  }

  search(query: LibraryQuery): void {
    this.cancel();
    this.timer = this.seams.schedule(() => {
      this.timer = null;
      this.start(query);
    }, SEARCH_DEBOUNCE_MS);
  }

  readNow(query: LibraryQuery): void {
    this.cancel();
    this.start(query);
  }

  cancel(): void {
    this.generation += 1;
    this.controller?.abort();
    this.controller = null;
    if (this.timer !== null) this.seams.cancel(this.timer);
    this.timer = null;
  }

  private start(query: LibraryQuery): void {
    const generation = ++this.generation;
    const controller = new AbortController();
    this.controller = controller;
    void this.seams.read(query, controller.signal).then(
      (answer) => {
        if (generation === this.generation) this.onResult(answer);
      },
      (error: unknown) => {
        if (generation === this.generation && !controller.signal.aborted) this.onRefusal(error);
      },
    );
  }
}

/** The Library's page read. The desktop is today's transport, byte for byte. In the browser (`61` sections 2.5 and
 *  2.6) the server's watch table is not this runtime's truth: History and the watching and watched sets are computed
 *  from the local entries (`library-local.ts`), the catalog pages go out without the `watched` param, and their rows
 *  come back decorated with the local watch marks. */
export async function readLibrary(query: LibraryQuery, signal?: AbortSignal, cursor?: string): Promise<LibraryPage> {
  const desktop = onDesktopRuntime();
  if (!desktop && query.source === "history") return readLocalHistory(query, "all", signal, cursor);
  if (!desktop && (query.watched === "watching" || query.watched === "watched")) {
    return readLocalHistory(query, query.watched, signal, cursor);
  }
  const params = new URLSearchParams();
  const collectionId = collectionOf(query.source);
  params.set("view", collectionId === null ? query.source : "collection");
  if (collectionId !== null) params.set("collectionId", collectionId);
  for (const type of query.scope) params.append("type", type);
  const search = query.search.trim();
  if (search !== "") params.set("q", search);
  params.set("sort", query.sort);
  for (const genre of query.genres) params.append("genre", genre);
  if (query.year !== "") params.set("year", query.year);
  if (desktop) params.set("watched", query.watched);
  if (cursor !== undefined) params.set("cursor", cursor);
  const schema = collectionId === null ? LibraryPageSchema : CollectionLibraryPageSchema;
  const answer = await api(`/api/library?${params.toString()}`, schema, { signal, area: "Catalog" });
  return desktop ? answer : decoratedLibraryPage(answer);
}

/** The Continue strip's rows: the server's selection on the desktop, the local one in the browser (`61` 2.5). */
export function readContinueRows(signal?: AbortSignal): Promise<readonly LibraryItem[]> {
  return onDesktopRuntime() ? readContinue(signal) : readLocalContinue(signal);
}

export function readContinue(signal?: AbortSignal) {
  return api("/api/library/continue", ContinuePageSchema, { signal, area: "Catalog" }).then((answer) => answer.items);
}

/** `POST /api/library/refresh` (`46` section E): the fileserver syncs its titles from the backend now and answers once
 *  the sync ends; a failure is the standard envelope's 503/502 with the cache still serving. */
export function refreshLibrary(signal?: AbortSignal) {
  return api("/api/library/refresh", LibraryRefreshSchema, { method: "POST", signal, area: "Catalog" });
}

export function libraryRowIdentity(item: LibraryItem): string {
  return item.watchId ?? `${item.ref.kind}:${item.ref.id}`;
}

export function appendLibraryPage(current: LibraryPage, next: LibraryPage): LibraryPage {
  const seen = new Set(current.items.map(libraryRowIdentity));
  const appended: LibraryItem[] = [];
  for (const item of next.items) {
    const identity = libraryRowIdentity(item);
    if (seen.has(identity)) continue;
    seen.add(identity);
    appended.push(item);
  }
  return {
    ...next,
    items: [...current.items, ...appended],
    total: next.total ?? current.total,
  };
}

export function libraryQueryKey(query: LibraryQuery): string {
  return JSON.stringify([
    query.source, query.scope, query.search.trim(), query.sort, query.genres, query.year, query.watched,
  ]);
}

export function canLoadLibraryPage(
  acceptedQueryKey: string | null,
  currentQueryKey: string,
  loading: boolean,
  paging: boolean,
  nextCursor: string | undefined,
): boolean {
  return acceptedQueryKey === currentQueryKey && !loading && !paging && nextCursor !== undefined;
}

export function knownLibraryCount(page: LibraryPage): number | undefined {
  return page.total ?? (page.nextCursor === undefined ? page.items.length : undefined);
}

export async function readAllLibraryPages(query: LibraryQuery, signal?: AbortSignal): Promise<LibraryPage> {
  let page: LibraryPage = await readLibrary(query, signal);
  const cursors = new Set<string>();
  while (page.nextCursor !== undefined) {
    const cursor = page.nextCursor;
    if (cursors.has(cursor)) throw new Error("The library returned the same page cursor twice.");
    cursors.add(cursor);
    const next = await readLibrary(query, signal, cursor);
    page = appendLibraryPage(page, next);
  }
  return page;
}
