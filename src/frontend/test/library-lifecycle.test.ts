import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_QUERY } from "@/lib/library-query";
import { reloadDecision, type ReloadInput } from "@/lib/library-reload";
import { LibrarySearchSession } from "@/services/library";
import type { LibraryPage } from "@/types/library";

const settledPage: LibraryPage = {
  items: [], facets: { genres: [], years: [] }, trending: false, titlesAvailable: true,
};
const mounted: ReloadInput = {
  initial: false, active: true, queryChanged: false, serialChanged: false, dirty: false, ready: true,
};

describe("Library hook lifecycle", () => {
  it("replaces a read cancelled by Strict Mode replay without reloading an ordinary rerender", () => {
    assert.equal(reloadDecision({ ...mounted, initial: true }).reload, true);
    assert.equal(reloadDecision(mounted).reload, false);
    assert.equal(reloadDecision({ ...mounted, interrupted: true }).reload, true);
  });

  it("cancels the active read on unmount and rejects its late answer", async () => {
    let accepted = 0;
    let signal: AbortSignal | undefined;
    let finish: ((answer: LibraryPage) => void) | undefined;
    const session = new LibrarySearchSession(() => { accepted += 1; }, () => assert.fail("unexpected refusal"), {
      read: (_query, nextSignal) => new Promise((resolve) => {
        signal = nextSignal;
        finish = resolve;
      }),
      schedule: () => 1,
      cancel: () => undefined,
    });

    session.readNow(DEFAULT_QUERY);
    session.cancel();
    assert.equal(signal?.aborted, true);
    finish?.(settledPage);
    await Promise.resolve();
    assert.equal(accepted, 0);
  });
});
