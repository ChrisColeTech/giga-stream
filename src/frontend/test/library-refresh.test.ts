import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { refreshLibrary } from "@/services/library";
import { syncLibrary } from "@/services/library-refresh";
import { useAppStore } from "@/store/app-store";

const originalFetch = globalThis.fetch;
const success = (data: unknown): Response =>
  new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: { "content-type": "application/json" } });

beforeEach(() => useAppStore.setState(useAppStore.getInitialState(), true));
afterEach(() => { globalThis.fetch = originalFetch; });

describe("Library Refresh", () => {
  it("posts the refresh and accepts the fileserver's answer", async () => {
    const calls: Array<[string, string | undefined]> = [];
    globalThis.fetch = async (input, init) => {
      calls.push([String(input), init?.method]);
      return success({ titlesAvailable: true, readAt: 1_760_000_000_000 });
    };
    assert.deepEqual(await refreshLibrary(), { titlesAvailable: true, readAt: 1_760_000_000_000 });
    assert.deepEqual(calls, [["/api/library/refresh", "POST"]]);
  });

  it("invalidates the Library and re-reads the side data once the sync ends", async () => {
    globalThis.fetch = async () => success({ titlesAvailable: false });
    const before = useAppStore.getState().libraryRefreshSerial;
    let sideReads = 0;
    await syncLibrary(() => { sideReads += 1; });
    assert.equal(useAppStore.getState().libraryRefreshSerial, before + 1);
    assert.equal(sideReads, 1);
  });

  it("says the refusal once and leaves the Library as it was", async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({
      ok: false,
      error: { code: "backend.unreachable", message: "The admin backend is not reachable." },
    }), { status: 503, headers: { "content-type": "application/json" } });
    const before = useAppStore.getState().libraryRefreshSerial;
    let sideReads = 0;
    await syncLibrary(() => { sideReads += 1; });
    assert.equal(useAppStore.getState().libraryRefreshSerial, before);
    assert.equal(sideReads, 0);
    assert.equal(useAppStore.getState().notice?.sentence, "The admin backend is not reachable.");
  });
});
