import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createScanObserver } from "@/lib/scan-observer";
import type { ScanTerminal } from "@/services/scan-stream";

const turn = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe("session scan observer", () => {
  it("keeps one stream across Collections lifecycle changes and aborts only when its owner closes", async () => {
    let starts = 0;
    let signal: AbortSignal | undefined;
    let finish: ((terminal: ScanTerminal) => void) | undefined;
    let refreshes = 0;
    const observer = createScanObserver({
      stream: (_folderId, _progress, nextSignal) => {
        starts += 1;
        signal = nextSignal;
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
      refresh: async () => {
        refreshes += 1;
      },
      setProgress: () => undefined,
      isMissing: () => false,
      done: () => undefined,
      warn: () => undefined,
    });

    observer.sync(["f-1"]);
    observer.sync(["f-1"]); // Opening or closing Collections does not replace the persistent observer.
    assert.equal(starts, 1);
    assert.equal(signal?.aborted, false);
    finish?.("done");
    await turn();
    assert.equal(refreshes, 1);

    observer.sync(["f-2"]);
    assert.equal(starts, 2);
    observer.close();
    assert.equal(signal?.aborted, true);
  });

  it("refreshes once before warning for a non-abort stream failure", async () => {
    const order: string[] = [];
    const observer = createScanObserver({
      stream: async () => {
        order.push("stream");
        throw new Error("The scan stream ended before it finished.");
      },
      refresh: async () => {
        order.push("refresh");
      },
      setProgress: () => undefined,
      isMissing: () => false,
      done: () => undefined,
      warn: () => order.push("warn"),
    });
    observer.sync(["f-1"]);
    await turn();
    assert.deepEqual(order, ["stream", "refresh", "warn"]);
  });

  it("refreshes a genuine no-scan refusal once without starting a request loop", async () => {
    let streams = 0;
    let refreshes = 0;
    let warnings = 0;
    const missing = new Error("No scan is running.");
    const observer = createScanObserver({
      stream: async () => {
        streams += 1;
        throw missing;
      },
      refresh: async () => {
        refreshes += 1;
      },
      setProgress: () => undefined,
      isMissing: (error) => error === missing,
      done: () => undefined,
      warn: () => {
        warnings += 1;
      },
    });
    observer.sync(["f-1"]);
    await turn();
    assert.deepEqual({ streams, refreshes, warnings }, { streams: 1, refreshes: 1, warnings: 0 });
  });
});
