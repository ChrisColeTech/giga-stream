import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_QUERY } from "@/lib/library-query";
import { reloadDecision, type ReloadInput } from "@/lib/library-reload";
import { startLibraryFirstPage } from "@/services/library-first-page";
import type { LibraryPage } from "@/types/library";

const settledPage: LibraryPage = {
  items: [], facets: { genres: [], years: [] }, trending: false, titlesAvailable: true,
};
const mounted: ReloadInput = {
  initial: false, active: true, queryChanged: false, serialChanged: false, dirty: false, ready: true,
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
      query: DEFAULT_QUERY, debounce: false,
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
      query: DEFAULT_QUERY, debounce: true,
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

  it("cancels the mounted session and rejects its late answer on unmount", async () => {
    let accepted = false;
    let pending: { readonly signal: AbortSignal | undefined; readonly resolve: (answer: LibraryPage) => void } | undefined;
    const cleanup = startLibraryFirstPage({
      query: DEFAULT_QUERY, debounce: false,
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
