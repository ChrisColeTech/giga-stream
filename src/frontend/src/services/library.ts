import { SEARCH_DEBOUNCE_MS } from "@/lib/live-constants";
import { collectionOf, type LibraryQuery } from "@/lib/library-query";
import { api } from "./api";
import { ContinuePageSchema, LibraryPageSchema } from "./schemas/library-schema";
import { notConnected, type ServiceResult } from "./not-connected";
import type { ItemRef } from "@/types/library";

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

export function readLibrary(query: LibraryQuery, signal?: AbortSignal) {
  const params = new URLSearchParams();
  const collectionId = collectionOf(query.source);
  params.set("view", collectionId === null ? query.source : "collection");
  if (collectionId !== null) params.set("collectionId", collectionId);
  params.set("type", query.scope);
  const search = query.search.trim();
  if (search !== "") params.set("q", search);
  params.set("sort", query.sort);
  for (const genre of query.genres) params.append("genre", genre);
  if (query.year !== "") params.set("year", query.year);
  params.set("watched", query.watched);
  return api(`/api/library?${params.toString()}`, LibraryPageSchema, { signal, area: "Catalog" });
}

export function readContinue(signal?: AbortSignal) {
  return api("/api/library/continue", ContinuePageSchema, { signal, area: "Catalog" }).then((answer) => answer.items);
}

/* Player and Settings retain their phase-1 calls until wave 2.5; Library uses the real modules above and `watch.ts`. */
export const playItem = (_ref: ItemRef): ServiceResult => notConnected();
export const playEpisode = (_ref: ItemRef, _season: number, _episode: number): ServiceResult => notConnected();
export const removeHistoryEntry = (_watchId: string): ServiceResult => notConnected();
export const clearHistory = (): ServiceResult => notConnected();
