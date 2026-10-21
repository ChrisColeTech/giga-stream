import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_QUERY, type LibraryQuery } from "@/lib/library-query";
import { reloadDecision, type ReloadInput } from "@/lib/library-reload";
import { startLibraryFirstPage, type LibraryReadIdentity } from "@/services/library-first-page";
import { libraryQueryKey } from "@/services/library";
import type { LibraryPage } from "@/types/library";

const settledPage: LibraryPage = {
  items: [], facets: { genres: [], years: [] }, trending: false, titlesAvailable: true,
};
const mounted: ReloadInput = {
  initial: false, active: true, queryChanged: false, serialChanged: false, dirty: false, ready: true,
};
const identity: LibraryReadIdentity = {
  queryKey: libraryQueryKey(DEFAULT_QUERY), refreshSerial: 0, sessionGeneration: 0,
};

describe("Library hook lifecycle", () => {
  it("does not reload an ordinary rerender", () => {
    assert.equal(reloadDecision({ ...mounted, initial: true }).reload, true);
    assert.equal(reloadDecision(mounted).reload, false);
  });

  it("accepts immediate request B after setup-request A-cleanup-setup-request B", async () => {
    const accepted: Array<number | undefined> = [];
    const pending: Array<{
      readonly signal: AbortSignal | undefined;
      readonly resolve: (answer: LibraryPage) => void;
    }> = [];
    const seams = {
      read: (_query: typeof DEFAULT_QUERY, signal?: AbortSignal) =>
        new Promise<LibraryPage>((resolve) => pending.push({ signal, resolve })),
      schedule: () => 1,
      cancel: () => undefined,
    };
    const setup = () => startLibraryFirstPage({
      query: DEFAULT_QUERY, debounce: false, identity, currentIdentity: () => identity,
      accept: (answer) => accepted.push(answer.total),
      refuse: () => assert.fail("unexpected refusal"),
    }, seams);

    const cleanupA = setup();
    cleanupA();
    setup();
    assert.equal(pending[0]?.signal?.aborted, true);
    assert.equal(pending[1]?.signal?.aborted, false);
    pending[0]?.resolve({ ...settledPage, total: 1 });
    pending[1]?.resolve({ ...settledPage, total: 2 });
    await Promise.resolve();
    assert.deepEqual(accepted, [2]);
  });

  it("keeps search as a cancellable 250 ms one-shot debounce", async () => {
    const scheduled = new Map<number, { readonly run: () => void; readonly delay: number }>();
    let accepted = false;
    let handle = 0;
    let resolve: ((answer: LibraryPage) => void) | undefined;
    const seams = {
      read: () => new Promise<LibraryPage>((done) => { resolve = done; }),
      schedule: (run: () => void, delay: number) => {
        const next = ++handle;
        scheduled.set(next, { run, delay });
        return next;
      },
      cancel: (cancelled: number) => { scheduled.delete(cancelled); },
    };
    const setup = () => startLibraryFirstPage({
      query: DEFAULT_QUERY, debounce: true, identity, currentIdentity: () => identity,
      accept: () => { accepted = true; },
      refuse: () => assert.fail("unexpected refusal"),
    }, seams);

    const cleanupA = setup();
    assert.equal(scheduled.get(1)?.delay, 250);
    cleanupA();
    assert.equal(scheduled.has(1), false);
    setup();
    scheduled.get(2)?.run();
    resolve?.(settledPage);
    await Promise.resolve();
    assert.equal(accepted, true);
  });

  it("rejects Favorites in the render-before-cleanup gap and accepts current All", async () => {
    const favorites = { ...DEFAULT_QUERY, source: "favorites" as const, scope: ["movie"] as const };
    const all = { ...DEFAULT_QUERY, source: "all" as const, scope: ["movie"] as const };
    const favoritesIdentity = {
      queryKey: libraryQueryKey(favorites), refreshSerial: 4, sessionGeneration: 1,
    };
    const allIdentity = { queryKey: libraryQueryKey(all), refreshSerial: 4, sessionGeneration: 2 };
    let current: LibraryReadIdentity = favoritesIdentity;
    let accepted: { readonly key: string; readonly rows: number } | null = null;
    const pending: Array<(answer: LibraryPage) => void> = [];
    const seams = {
      read: () => new Promise<LibraryPage>((resolve) => pending.push(resolve)),
      schedule: () => 1,
      cancel: () => undefined,
    };
    const setup = (query: LibraryQuery, captured: LibraryReadIdentity) => startLibraryFirstPage({
      query, debounce: false, identity: captured, currentIdentity: () => current,
      accept: (answer) => { accepted = { key: captured.queryKey, rows: answer.items.length }; },
      refuse: () => assert.fail("unexpected refusal"),
    }, seams);

    const cleanupFavorites = setup(favorites, favoritesIdentity);
    current = allIdentity;
    pending[0]?.({ ...settledPage, total: 0 });
    await Promise.resolve();
    assert.equal(accepted, null);
    cleanupFavorites();
    setup(all, allIdentity);
    const items = Array.from({ length: 20 }, (_, index) => ({
      ref: { kind: "title" as const, id: `movie-${index}` }, kind: "movie" as const,
      title: `Movie ${index}`, genres: [], favorite: false,
    }));
    pending[1]?.({ ...settledPage, items, total: 43_227 });
    await Promise.resolve();
    assert.deepEqual(accepted, { key: allIdentity.queryKey, rows: 20 });
  });

  it("cancels the mounted session and rejects its late answer on unmount", async () => {
    let accepted = false;
    let pending: { readonly signal: AbortSignal | undefined; readonly resolve: (answer: LibraryPage) => void } | undefined;
    const cleanup = startLibraryFirstPage({
      query: DEFAULT_QUERY, debounce: false, identity, currentIdentity: () => identity,
      accept: () => { accepted = true; },
      refuse: () => assert.fail("unexpected refusal"),
    }, {
      read: (_query, signal) => new Promise((resolve) => {
        pending = { signal, resolve };
      }),
      schedule: () => 1,
      cancel: () => undefined,
    });

    cleanup();
    assert.equal(pending?.signal?.aborted, true);
    pending?.resolve(settledPage);
    await Promise.resolve();
    assert.equal(accepted, false);
  });
});
