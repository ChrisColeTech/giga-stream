import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { ACCOUNT_SETTINGS_NOTICE, SETTINGS_CACHE_NOTICE } from "@/constants/gate-copy";
import { DEFAULT_SETTINGS } from "@/constants/settings-defaults";
import { startSettingsWriteback } from "@/hooks/useSettingsWriteback";
import { mergeAccountSettings } from "@/services/settings-merge";
import { patchSettings } from "@/services/settings";
import type { LocalStorageLike } from "@/services/local-state";
import { useAppStore } from "@/store/app-store";

const state = () => useAppStore.getState();

/** The defaults with a real admin address, so every document satisfies the wire schema both homes validate with. */
const DEVICE = { ...DEFAULT_SETTINGS, adminUrl: "http://fileserver.test/admin" };

const originalFetch = globalThis.fetch;

const success = (data: unknown) => new Response(JSON.stringify({ ok: true, data }), { status: 200 });
const unreachable = () => new Response(null, { status: 503 });

interface Call {
  readonly input: string;
  readonly method?: string;
  readonly body?: string;
}

/** A fake browser window with a `Storage`-shaped stub. */
function fakeBrowserWindow(entries: Record<string, string>): void {
  const storage: LocalStorageLike = {
    getItem: (key) => (key in entries ? entries[key] : null),
    setItem: (key, value) => {
      entries[key] = value;
    },
    removeItem: (key) => {
      delete entries[key];
    },
  };
  (globalThis as { window?: unknown }).window = { localStorage: storage };
}

/** A fake desktop window: the preload capability names the runtime, and a storage stub exists to prove the desktop
 *  writes into none of it. */
function fakeDesktopWindow(entries: Record<string, string>): void {
  const storage: LocalStorageLike = {
    getItem: (key) => (key in entries ? entries[key] : null),
    setItem: (key, value) => {
      entries[key] = value;
    },
    removeItem: (key) => {
      delete entries[key];
    },
  };
  (globalThis as { window?: unknown }).window = { pocHost: { runtime: "electron" }, localStorage: storage };
}

/** Lets the write-back's queued write settle: the microtasks of the request chain, then one macrotask in case the
 *  response body takes one. */
const settled = async (): Promise<void> => {
  for (let at = 0; at < 5; at += 1) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
  state().applySnapshot({ settings: DEVICE, unreadable: [] });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  Reflect.deleteProperty(globalThis, "window");
});

describe("the settings merge at sign-in (`62` D8)", () => {
  it("the account's settings win once: its keys replace the device's, the rest stand, and the drawer says so", async () => {
    state().setTheme("dark");
    state().setAccent("violet");
    fakeBrowserWindow({});
    globalThis.fetch = async () => success({ settings: { theme: "light", uiZoom: 2 } });
    await mergeAccountSettings();
    assert.equal(state().theme, "light");
    assert.equal(state().uiZoom, 2);
    assert.equal(state().accent, "violet");
    assert.equal(state().playback.autoplay, DEVICE.autoplay);
    /* Only the account's keys replace: the accent was this device's latest change, and the account said nothing
     *  about it, so the merged document keeps it. */
    assert.deepEqual(state().committedSettings, { ...DEVICE, theme: "light", themeAccent: "violet", uiZoom: 2 });
    const said = state().events.some((row) => row.sentence === ACCOUNT_SETTINGS_NOTICE);
    assert.equal(said, true);
    assert.equal(state().settingsRevision, state().savedSettingsRevision);
  });

  it("the merged document is mirrored into the browser's local store as the offline cache", async () => {
    const local: Record<string, string> = {};
    fakeBrowserWindow(local);
    globalThis.fetch = async () => success({ settings: { theme: "light" } });
    await mergeAccountSettings();
    assert.deepEqual(JSON.parse(local["giga.v1.settings"] ?? "{}"), { ...DEVICE, theme: "light" });
  });

  it("an account document with nothing in it replaces nothing and says nothing", async () => {
    state().setTheme("light");
    fakeBrowserWindow({});
    globalThis.fetch = async () => success({ settings: {} });
    await mergeAccountSettings();
    assert.equal(state().theme, "light");
    assert.equal(state().events.some((row) => row.sentence === ACCOUNT_SETTINGS_NOTICE), false);
  });

  it("an unreadable account merges nothing and keeps the device's settings", async () => {
    state().setTheme("light");
    fakeBrowserWindow({});
    globalThis.fetch = async () => unreachable();
    await mergeAccountSettings();
    assert.equal(state().theme, "light");
    assert.equal(state().events.some((row) => row.sentence === ACCOUNT_SETTINGS_NOTICE), false);
  });

  it("a local cache that refuses the mirror is a warning, never a failed sign-in", async () => {
    const refusing: LocalStorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => undefined,
    };
    (globalThis as { window?: unknown }).window = { localStorage: refusing };
    globalThis.fetch = async () => success({ settings: { theme: "light" } });
    await mergeAccountSettings();
    assert.equal(state().theme, "light");
    assert.equal(state().events.some((row) => row.sentence === SETTINGS_CACHE_NOTICE), true);
  });
});

describe("settings writes with a live session (`62` section 3.6)", () => {
  it("a browser's write goes to the account as a whole document and mirrors into the local cache", async () => {
    const local: Record<string, string> = {};
    fakeBrowserWindow(local);
    useAppStore.setState({ signedIn: true });
    const calls: Call[] = [];
    globalThis.fetch = async (input, init) => {
      calls.push({ input: String(input), method: init?.method, body: String(init?.body) });
      return success({ settings: JSON.parse(String(init?.body)), updatedAt: 5 });
    };
    const stop = startSettingsWriteback({
      getState: useAppStore.getState,
      subscribe: useAppStore.subscribe,
      write: patchSettings,
    });
    state().setTheme("light");
    await settled();
    assert.deepEqual(calls, [
      {
        input: "/api/account/settings",
        method: "PUT",
        body: JSON.stringify({ ...DEVICE, theme: "light" }),
      },
    ]);
    assert.deepEqual(JSON.parse(local["giga.v1.settings"] ?? "{}"), { ...DEVICE, theme: "light" });
    assert.deepEqual(state().committedSettings, { ...DEVICE, theme: "light" });
    stop();
  });

  it("a desktop's write goes to the account and stores nothing in any browser storage", async () => {
    const local: Record<string, string> = {};
    fakeDesktopWindow(local);
    useAppStore.setState({ signedIn: true });
    const calls: Call[] = [];
    globalThis.fetch = async (_input, init) => {
      calls.push({ input: "/api/account/settings", method: init?.method, body: String(init?.body) });
      return success({ settings: JSON.parse(String(init?.body)) });
    };
    const stop = startSettingsWriteback({
      getState: useAppStore.getState,
      subscribe: useAppStore.subscribe,
      write: patchSettings,
    });
    state().setTheme("light");
    await settled();
    assert.deepEqual(calls.map((call) => [call.input, call.method]), [["/api/account/settings", "PUT"]]);
    assert.deepEqual(local, {});
    stop();
  });

  it("sign-out keeps the device's local state: the cache and the committed settings stand", async () => {
    const local: Record<string, string> = {};
    fakeBrowserWindow(local);
    useAppStore.setState({ signedIn: true });
    globalThis.fetch = async (_input, init) => success({ settings: JSON.parse(String(init?.body)) });
    const stop = startSettingsWriteback({
      getState: useAppStore.getState,
      subscribe: useAppStore.subscribe,
      write: patchSettings,
    });
    state().setTheme("light");
    await settled();
    stop();
    state().signOut();
    assert.equal(state().signedIn, false);
    assert.deepEqual(JSON.parse(local["giga.v1.settings"] ?? "{}"), { ...DEVICE, theme: "light" });
    assert.deepEqual(state().committedSettings, { ...DEVICE, theme: "light" });
    assert.equal(state().theme, "light");
  });
});
