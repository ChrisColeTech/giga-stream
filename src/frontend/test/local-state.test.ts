import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_SETTINGS } from "@/constants/settings-defaults";
import {
  LOCAL_LAST_CHANNEL_KEY,
  LOCAL_SETTINGS_KEY,
  LOCAL_SHELL_KEY,
  readLocalLastChannel,
  readLocalSettings,
  readLocalShell,
  writeLocalLastChannel,
  writeLocalSettings,
  writeLocalShell,
  type LocalStorageLike,
} from "@/services/local-state";
import type { ShellStateAnswer } from "@/services/schemas/state-schema";

/** A `Storage`-shaped stub over a plain record - the tests never touch a real window. */
function stubStorage(entries: Record<string, string> = {}): LocalStorageLike & { store: Record<string, string> } {
  return {
    store: entries,
    getItem: (key) => (key in entries ? entries[key] : null),
    setItem: (key, value) => {
      entries[key] = value;
    },
  };
}

const SHELL: ShellStateAnswer = {
  activeSurface: "player",
  paneVisibility: { "player.browser": false, "player.inspector": true },
  paneSizes: { "player.browser": [240], "player.inspector": [300] },
};

/** The defaults with a real admin address: the placeholder default carries an empty one, which the wire schema
 *  refuses, so no local answer can be built from it alone. */
const SETTINGS = { ...DEFAULT_SETTINGS, adminUrl: "http://fileserver.test/admin" };

describe("the local store", () => {
  it("round-trips each domain through its versioned key", () => {
    const storage = stubStorage();
    assert.equal(writeLocalShell(SHELL, storage), true);
    assert.equal(writeLocalSettings(SETTINGS, storage), true);
    assert.equal(writeLocalLastChannel("fx-news", storage), true);
    assert.deepEqual(readLocalShell(storage), { value: SHELL, unreadable: false });
    assert.deepEqual(readLocalSettings(storage), { value: SETTINGS, unreadable: false });
    assert.deepEqual(readLocalLastChannel(storage), { value: "fx-news", unreadable: false });
    assert.deepEqual(Object.keys(storage.store).sort(), [LOCAL_LAST_CHANNEL_KEY, LOCAL_SETTINGS_KEY, LOCAL_SHELL_KEY]);
  });

  it("discards a corrupt blob as unreadable and keeps its readable siblings", () => {
    const storage = stubStorage({ [LOCAL_SHELL_KEY]: "{not json", [LOCAL_SETTINGS_KEY]: JSON.stringify(SETTINGS) });
    assert.deepEqual(readLocalShell(storage), { value: undefined, unreadable: true });
    assert.deepEqual(readLocalSettings(storage), { value: SETTINGS, unreadable: false });
  });

  it("discards a schema-mismatched blob - an older shape, a bad enum, a non-string channel", () => {
    const storage = stubStorage({
      [LOCAL_SHELL_KEY]: JSON.stringify({ ...SHELL, activeSurface: "cinema" }),
      [LOCAL_SETTINGS_KEY]: JSON.stringify({ theme: "dark" }),
      [LOCAL_LAST_CHANNEL_KEY]: JSON.stringify(42),
    });
    assert.deepEqual(readLocalShell(storage), { value: undefined, unreadable: true });
    assert.deepEqual(readLocalSettings(storage), { value: undefined, unreadable: true });
    assert.deepEqual(readLocalLastChannel(storage), { value: undefined, unreadable: true });
  });

  it("reads an absent key as nothing, not as an unreadable part", () => {
    const storage = stubStorage();
    assert.deepEqual(readLocalShell(storage), { value: undefined, unreadable: false });
    assert.deepEqual(readLocalSettings(storage), { value: undefined, unreadable: false });
    assert.deepEqual(readLocalLastChannel(storage), { value: undefined, unreadable: false });
  });

  it("answers a refused write with false, keeps the stored state and never throws", () => {
    const storage = stubStorage({ [LOCAL_SHELL_KEY]: JSON.stringify(SHELL) });
    const refusing: LocalStorageLike = {
      getItem: (key) => storage.getItem(key),
      setItem: () => {
        throw new Error("quota");
      },
    };
    assert.equal(writeLocalShell({ ...SHELL, activeSurface: "live" }, refusing), false);
    assert.equal(writeLocalLastChannel("fx-news", refusing), false);
    assert.deepEqual(readLocalShell(refusing), { value: SHELL, unreadable: false });
  });

  it("treats a store-less environment as a quiet no-op, and still refuses a value the schema rejects", () => {
    assert.equal(writeLocalLastChannel("fx-news", null), true);
    assert.equal(writeLocalShell(SHELL, null), true);
    assert.equal(writeLocalSettings({ ...DEFAULT_SETTINGS }, stubStorage()), false);
  });
});
