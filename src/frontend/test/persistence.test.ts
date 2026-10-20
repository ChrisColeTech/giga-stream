import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { DEFAULT_SETTINGS } from "@/constants/settings-defaults";
import { patchShellState, readShellState } from "@/services/shell-state";
import { patchSettings, readSettings } from "@/services/settings";
import { onDesktopRuntime, storeFor, type ShellStore } from "@/services/persistence";
import type { LocalStorageLike } from "@/services/local-state";
import { useAppStore } from "@/store/app-store";

const originalFetch = globalThis.fetch;

/** A `Storage`-shaped stub over a plain record, mounted as the fake window's storage. */
function stubOf(entries: Record<string, string>): LocalStorageLike {
  return {
    getItem: (key) => (key in entries ? entries[key] : null),
    setItem: (key, value) => {
      entries[key] = value;
    },
  };
}

function browserWindow(entries: Record<string, string>): void {
  (globalThis as { window?: unknown }).window = { localStorage: stubOf(entries) };
}

function desktopWindow(entries: Record<string, string>): void {
  (globalThis as { window?: unknown }).window = { pocHost: { runtime: "electron" }, localStorage: stubOf(entries) };
}

const success = (data: unknown) => new Response(JSON.stringify({ ok: true, data }), { status: 200 });

const SHELL_WIRE = { activeSurface: "live", paneVisibility: {}, paneSizes: {} };
const SETTINGS = { ...DEFAULT_SETTINGS, adminUrl: "http://fileserver.test/admin" };

describe("the storage resolver", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    Reflect.deleteProperty(globalThis, "window");
    useAppStore.setState(useAppStore.getInitialState(), true);
  });

  it("on the desktop both domains delegate to the exact REST calls and store nothing locally", async () => {
    const local: Record<string, string> = {};
    desktopWindow(local);
    assert.equal(onDesktopRuntime(), true);
    const calls: Array<{ input: string; method?: string; body?: BodyInit | null }> = [];
    globalThis.fetch = async (input, init) => {
      calls.push({ input: String(input), method: init?.method, body: init?.body });
      return calls.length === 1 ? success(SHELL_WIRE) : success(SETTINGS);
    };
    assert.deepEqual(await readShellState(), { surface: "live", open: {}, sizes: {} });
    assert.deepEqual(await patchSettings({ theme: "light" }), SETTINGS);
    assert.deepEqual(calls.map((call) => [call.input, call.method]), [
      ["/api/shell-state", "GET"],
      ["/api/settings", "PATCH"],
    ]);
    assert.equal(calls[1]?.body, JSON.stringify({ theme: "light" }));
    assert.deepEqual(local, {});
  });

  it("in a browser both domains go local: no request, the blob stored and read back", async () => {
    const local: Record<string, string> = {};
    browserWindow(local);
    globalThis.fetch = async () => {
      throw new Error("no request may leave the page");
    };
    useAppStore.setState({ committedSettings: SETTINGS });
    await patchSettings({ theme: "light" });
    assert.deepEqual(await readSettings(), { ...SETTINGS, theme: "light" });
    assert.deepEqual(JSON.parse(local["giga.v1.settings"] ?? "{}"), { ...SETTINGS, theme: "light" });
    await patchShellState({ surface: "player", open: { "player.left": false }, sizes: {} });
    assert.deepEqual(JSON.parse(local["giga.v1.shell"] ?? "{}"), {
      activeSurface: "player",
      paneVisibility: { "player.browser": false },
      paneSizes: {},
    });
    const layout = await readShellState();
    assert.equal(layout.surface, "player");
    assert.equal(layout.open["player.left"], false);
  });

  it("consults the runtime at each call and keeps the session input pinned to the server backend", () => {
    const layout = { surface: "live" as const, open: {}, sizes: {} };
    const server: ShellStore = { read: async () => layout, write: async (value) => value };
    const local: ShellStore = { read: async () => layout, write: async (value) => value };
    const backends = { server, local };
    browserWindow({});
    assert.equal(storeFor("shell", backends), local);
    desktopWindow({});
    assert.equal(storeFor("shell", backends), server);
    browserWindow({});
    assert.equal(storeFor("shell", backends, { signedIn: true }), server);
  });
});
