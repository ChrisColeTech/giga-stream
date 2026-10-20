import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_QUERY } from "@/lib/library-query";
import { reloadDecision, type ReloadInput } from "@/lib/library-reload";
import { LibrarySearchSession } from "@/services/library";
import { LibrarySearchLifecycle } from "@/services/library-search-lifecycle";
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

  it("accepts the replacement session answer after setup-cleanup-setup", async () => {
    const accepted: Array<number | undefined> = [];
    const pending: Array<{
      readonly signal: AbortSignal | undefined;
      readonly resolve: (answer: LibraryPage) => void;
    }> = [];
    const lifecycle = new LibrarySearchLifecycle(() => new LibrarySearchSession(
      (answer) => accepted.push(answer.total),
      () => assert.fail("unexpected refusal"),
      {
        read: (_query, signal) => new Promise((resolve) => pending.push({ signal, resolve })),
        schedule: () => 1,
        cancel: () => undefined,
      },
    ));

    lifecycle.setup();
    lifecycle.readNow(DEFAULT_QUERY);
    lifecycle.cleanup();
    lifecycle.setup();
    lifecycle.readNow(DEFAULT_QUERY);
    assert.equal(pending[0]?.signal?.aborted, true);
    assert.equal(pending[1]?.signal?.aborted, false);
    pending[0]?.resolve({ ...settledPage, total: 1 });
    pending[1]?.resolve({ ...settledPage, total: 2 });
    await Promise.resolve();
    assert.deepEqual(accepted, [2]);
  });

  it("cancels the mounted session and rejects its late answer on unmount", async () => {
    let accepted = false;
    let pending: { readonly signal: AbortSignal | undefined; readonly resolve: (answer: LibraryPage) => void } | undefined;
    const lifecycle = new LibrarySearchLifecycle(() => new LibrarySearchSession(
      () => { accepted = true; },
      () => assert.fail("unexpected refusal"),
      {
        read: (_query, signal) => new Promise((resolve) => {
          pending = { signal, resolve };
        }),
        schedule: () => 1,
        cancel: () => undefined,
      },
    ));

    lifecycle.setup();
    lifecycle.readNow(DEFAULT_QUERY);
    lifecycle.cleanup();
    assert.equal(pending?.signal?.aborted, true);
    pending?.resolve(settledPage);
    await Promise.resolve();
    assert.equal(accepted, false);
  });
});
