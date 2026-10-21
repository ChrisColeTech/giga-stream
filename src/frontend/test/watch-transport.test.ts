import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { clearWatch, removeWatch, writeWatch } from "@/services/watch";
import { onDesktopRuntime } from "@/services/persistence";
import { useAppStore } from "@/store/app-store";

const originalFetch = globalThis.fetch;

const success = (data: unknown) => new Response(JSON.stringify({ ok: true, data }), { status: 200 });

function browserWindow(): void {
  (globalThis as { window?: unknown }).window = {};
}

function desktopWindow(): void {
  (globalThis as { window?: unknown }).window = { pocHost: { runtime: "electron" } };
}

interface Call {
  readonly input: string;
  readonly method?: string;
  readonly body?: string;
  readonly keepalive?: boolean;
  readonly headers: Readonly<Record<string, string>>;
}

/** A fetch that records every call and answers each watch route its own envelope shape. */
function recordingFetch(calls: Call[]): void {
  globalThis.fetch = async (input, init) => {
    const path = String(input);
    calls.push({
      input: path, method: init?.method,
      body: typeof init?.body === "string" ? init.body : undefined,
      keepalive: init?.keepalive === true ? true : undefined,
      headers: (init?.headers ?? {}) as Readonly<Record<string, string>>,
    });
    // Each route its own answer shape: the schemas at the boundary are exact, so a write answer would not parse
    // as a removal or a clear.
    if (init?.method === "PUT") return success({ applied: true, entry: null });
    if (path === "/api/watch/watch-1") return success({ removed: "watch-1" });
    return success({ cleared: 2 });
  };
}

const WRITE = { item: { kind: "title" as const, id: "t1" }, positionMs: 5_000, durationMs: 10_000, playbackId: "p1", seq: 3 };

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  Reflect.deleteProperty(globalThis, "window");
  /* The verbs leave the session they held; a reset keeps the next file's tests at the signed-out start. */
  useAppStore.setState(useAppStore.getInitialState(), true);
});

describe("the watch write's single contract (`63` sections 3.2 and 3.3)", () => {
  it("on the desktop with a session the three calls are the exact REST transport, marker and keepalive included", async () => {
    desktopWindow();
    useAppStore.setState({ signedIn: true });
    assert.equal(onDesktopRuntime(), true);
    const calls: Call[] = [];
    recordingFetch(calls);
    const answer = await writeWatch(WRITE);
    assert.deepEqual(answer, { applied: true, entry: null });
    await writeWatch({ ...WRITE, positionMs: 6_000, seq: 4 }, { keepalive: true });
    await removeWatch("watch-1");
    await clearWatch();
    assert.deepEqual(calls.map((call) => [call.input, call.method, call.keepalive]), [
      ["/api/watch", "PUT", undefined],
      ["/api/watch", "PUT", true],
      ["/api/watch/watch-1", "DELETE", undefined],
      ["/api/watch", "DELETE", undefined],
    ]);
    assert.equal(JSON.parse(calls[0]?.body ?? "null")?.positionMs, 5_000);
    for (const call of calls) assert.equal(call.headers["x-giga-runtime"], "electron");
  });

  it("in a signed-in browser the same contract goes out - the bearer rides it, the marker does not", async () => {
    browserWindow();
    useAppStore.setState({
      signedIn: true,
      session: { id: "acc-1", username: "ivy", kind: "user" },
      tokens: { accessToken: "token-1", accessExpiresAt: 1, refreshToken: "r", refreshExpiresAt: 2 },
    });
    const calls: Call[] = [];
    recordingFetch(calls);
    await writeWatch(WRITE);
    await removeWatch("watch-1");
    await clearWatch();
    assert.deepEqual(calls.map((call) => [call.input, call.method]), [
      ["/api/watch", "PUT"],
      ["/api/watch/watch-1", "DELETE"],
      ["/api/watch", "DELETE"],
    ]);
    for (const call of calls) {
      assert.equal(call.headers["x-giga-runtime"], undefined);
      assert.equal(call.headers.authorization, "Bearer token-1");
    }
  });

  it("signed out the client never calls - every verb refuses before the wire", async () => {
    browserWindow();
    globalThis.fetch = async () => {
      throw new Error("no request may leave the page");
    };
    await assert.rejects(writeWatch(WRITE), /not kept while signed out/);
    await assert.rejects(removeWatch("watch-1"), /not kept while signed out/);
    await assert.rejects(clearWatch(), /not kept while signed out/);
  });

  it("signed out on the desktop too: the fileserver's watch routes are simply never called", async () => {
    desktopWindow();
    globalThis.fetch = async () => {
      throw new Error("no request may leave the page");
    };
    await assert.rejects(writeWatch(WRITE), /not kept while signed out/);
    await assert.rejects(clearWatch(), /not kept while signed out/);
  });

  it("the runtime marker appears only under pocHost: a browser window sends none", async () => {
    browserWindow();
    useAppStore.setState({ signedIn: true });
    const calls: Call[] = [];
    recordingFetch(calls);
    await writeWatch(WRITE);
    assert.equal(calls[0]?.headers["x-giga-runtime"], undefined);
  });
});
