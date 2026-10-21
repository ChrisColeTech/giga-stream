import { SEARCH_DEBOUNCE_MS } from "@/lib/live-constants";
import type { LibraryQuery } from "@/lib/library-query";
import type { LibraryPage } from "@/types/library";
import { readLibrary } from "./library";

export interface LibraryFirstPageSeams {
  readonly read: typeof readLibrary;
  readonly schedule: (callback: () => void, delay: number) => number;
  readonly cancel: (handle: number) => void;
}

export interface LibraryFirstPageSetup {
  readonly query: LibraryQuery;
  readonly debounce: boolean;
  readonly accept: (answer: LibraryPage) => void;
  readonly refuse: (error: unknown) => void;
}

const SEAMS: LibraryFirstPageSeams = {
  read: readLibrary,
  schedule: (callback, delay) => window.setTimeout(callback, delay),
  cancel: (handle) => window.clearTimeout(handle),
};
const aborted = (error: unknown): boolean => error instanceof DOMException && error.name === "AbortError";

/** Starts one effect-owned immediate or debounced read. Cleanup answers whether it cancelled unsettled work. */
export function startLibraryFirstPage(
  setup: LibraryFirstPageSetup,
  seams: LibraryFirstPageSeams = SEAMS,
): () => boolean {
  let live = true;
  let settled = false;
  let timer: number | null = null;
  let controller: AbortController | null = null;
  const start = (): void => {
    if (!live) return;
    controller = new AbortController();
    const owned = controller;
    void seams.read(setup.query, owned.signal).then((answer) => {
      if (!live || controller !== owned) return;
      settled = true;
      setup.accept(answer);
    }).catch((error: unknown) => {
      if (!live || controller !== owned || aborted(error)) return;
      settled = true;
      setup.refuse(error);
    });
  };
  if (setup.debounce) timer = seams.schedule(start, SEARCH_DEBOUNCE_MS);
  else start();
  return () => {
    const cancelledPending = !settled;
    live = false;
    if (timer !== null) seams.cancel(timer);
    controller?.abort();
    return cancelledPending;
  };
}
