import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { DEFAULT_SURFACE } from "@/constants/surfaces";
import { DEFAULT_SETTINGS } from "@/constants/settings-defaults";
import { startSettingsWriteback } from "@/hooks/useSettingsWriteback";
import { startShellWriteback } from "@/hooks/useShellWriteback";
import type { LocalStorageLike } from "@/services/local-state";
import type { SettingsPatch } from "@/services/schemas/settings-schema";
import type { ShellLayout } from "@/services/shell-state";
import { useAppStore } from "@/store/app-store";

const state = () => useAppStore.getState();

/** The defaults with a real admin address, so the blob satisfies the wire schema the local store validates with. */
const VALID_SETTINGS = { ...DEFAULT_SETTINGS, adminUrl: "http://fileserver.test/admin" };

/** A fake browser window: no pocHost (so the runtime reads browser) and a `Storage`-shaped stub. */
function fakeBrowserWindow(entries: Record<string, string>): void {
  const storage: LocalStorageLike = {
    getItem: (key) => (key in entries ? entries[key] : null),
    setItem: (key, value) => {
      entries[key] = value;
    },
  };
  (globalThis as { window?: unknown }).window = { localStorage: storage };
}

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
});

describe("browser hydration (`61` section 2.4)", () => {
  it("hydrates the local shell, settings and last channel and opens the write gates with no server answer", () => {
    fakeBrowserWindow({
      "giga.v1.shell": JSON.stringify({
        activeSurface: "player",
        paneVisibility: { "player.browser": false },
        paneSizes: { "player.browser": [300] },
      }),
      "giga.v1.settings": JSON.stringify({ ...VALID_SETTINGS, theme: "light" }),
      "giga.v1.lastChannelId": JSON.stringify("fx-news"),
    });
    state().applySnapshot({ unreadable: [] });
    assert.equal(state().surface, "player");
    assert.equal(state().open["player.left"], false);
    assert.equal(state().sizes["player.left"], 300);
    assert.equal(state().theme, "light");
    assert.equal(state().lastChannelId, "fx-news");
    assert.equal(state().shellWriteEnabled, true);
    assert.equal(state().settingsWriteEnabled, true);
    assert.deepEqual(state().committedSettings, { ...VALID_SETTINGS, theme: "light" });
  });

  it("seeds a fresh browser from the snapshot's parts and still opens the write gates", () => {
    fakeBrowserWindow({});
    state().applySnapshot({
      shell: { activeSurface: "library", paneVisibility: {}, paneSizes: {} },
      settings: VALID_SETTINGS,
      lastChannelId: "fx-news",
      unreadable: [],
    });
    assert.equal(state().surface, "library");
    assert.equal(state().lastChannelId, "fx-news");
    assert.equal(state().shellWriteEnabled, true);
    assert.equal(state().settingsWriteEnabled, true);
  });

  it("prefers the local parts over the snapshot's when the browser has them", () => {
    fakeBrowserWindow({
      "giga.v1.shell": JSON.stringify({ activeSurface: "player", paneVisibility: {}, paneSizes: {} }),
    });
    state().applySnapshot({
      shell: { activeSurface: "library", paneVisibility: {}, paneSizes: {} },
      unreadable: [],
    });
    assert.equal(state().surface, "player");
  });

  it("discards a corrupt local blob, says so once and still opens the write gates", () => {
    fakeBrowserWindow({ "giga.v1.shell": "{not json", "giga.v1.settings": JSON.stringify({ theme: "bogus" }) });
    state().applySnapshot({ unreadable: [] });
    assert.equal(state().surface, DEFAULT_SURFACE);
    assert.equal(state().shellWriteEnabled, true);
    assert.equal(state().settingsWriteEnabled, true);
    assert.equal(state().notice?.tone, "warn");
    assert.match(state().notice?.sentence ?? "", /shell, settings/);
  });
});

describe("browser-mode write-back", () => {
  it("writes the locally-hydrated shell and settings with no server answer at all", async () => {
    fakeBrowserWindow({
      "giga.v1.shell": JSON.stringify({ activeSurface: "live", paneVisibility: {}, paneSizes: {} }),
      "giga.v1.settings": JSON.stringify(VALID_SETTINGS),
    });
    state().applySnapshot({ unreadable: [] });
    const layouts: ShellLayout[] = [];
    const patches: SettingsPatch[] = [];
    let timer: (() => void) | undefined;
    const stopShell = startShellWriteback({
      getState: useAppStore.getState,
      subscribe: useAppStore.subscribe,
      write: async (layout) => {
        layouts.push(layout);
        return layout;
      },
      schedule: (task) => {
        timer = task;
        return 1;
      },
      cancel: () => undefined,
    });
    const stopSettings = startSettingsWriteback({
      getState: useAppStore.getState,
      subscribe: useAppStore.subscribe,
      write: async (patch) => {
        patches.push(patch);
        return { ...VALID_SETTINGS, ...patch };
      },
    });
    state().setSurface("player");
    timer?.();
    state().setTheme("light");
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(layouts.length, 1);
    assert.equal(layouts[0]?.surface, "player");
    assert.deepEqual(patches, [{ theme: "light" }]);
    stopShell();
    stopSettings();
  });
});
