import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { performSignOut } from "@/hooks/useSignOut";
import {
  LOCAL_LAST_CHANNEL_KEY,
  LOCAL_SETTINGS_KEY,
  LOCAL_SHELL_KEY,
  type LocalStorageLike,
} from "@/services/local-state";
import { useAppStore } from "@/store/app-store";

const originalWindow = globalThis.window;

function storageOf(entries: Record<string, string>): LocalStorageLike {
  return {
    getItem: (key) => entries[key] ?? null,
    setItem: (key, value) => { entries[key] = value; },
    removeItem: (key) => { delete entries[key]; },
  };
}

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
  (globalThis as { window?: unknown }).window = {};
});

afterEach(() => {
  if (originalWindow === undefined) Reflect.deleteProperty(globalThis, "window");
  else (globalThis as { window?: unknown }).window = originalWindow;
});

describe("logout reset (`65` wave 2)", () => {
  it("clears synchronously despite transport failure and removes only owned browser keys", async () => {
    const entries = {
      [LOCAL_SHELL_KEY]: "shell",
      [LOCAL_SETTINGS_KEY]: "settings",
      [LOCAL_LAST_CHANNEL_KEY]: "channel",
      "another.app": "keep",
    };
    const state = useAppStore.getState();
    state.adoptSession({
      actor: { id: "acct-1", username: "ivy", kind: "user" },
      tokens: { accessToken: "a", accessExpiresAt: 1, refreshToken: "r", refreshExpiresAt: 2 },
    });
    state.setSurface("player");
    state.setTheme("light");
    state.openGate();
    state.openOverlay("collections");
    state.setCollections([{
      id: "c-1", name: "Films", type: "movie", itemCount: 0, folders: [], scanning: false,
      createdAt: 1, updatedAt: 1,
    }]);
    state.setFavourite("title:t-1", true);
    state.rememberWatch({
      watchId: "w-1",
      item: { kind: "title", id: "t-1" },
      positionMs: 10,
      durationMs: 20,
      state: "watching",
    });

    const finished = performSignOut(() => Promise.reject(new Error("offline")), storageOf(entries));
    const cleared = useAppStore.getState();
    assert.equal(cleared.signedIn, false);
    assert.equal(cleared.tokens, null);
    assert.equal(cleared.surface, "live");
    assert.equal(cleared.theme, "dark");
    assert.equal(cleared.gateOpen, false);
    assert.equal(cleared.overlay, null);
    assert.deepEqual(cleared.collections, []);
    assert.deepEqual(cleared.marks, { favourites: {}, memberships: {}, membershipSources: {} });
    assert.deepEqual(cleared.watchMarks, {});
    assert.deepEqual(entries, { "another.app": "keep" });
    await finished;
  });
});
