import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { firstShown, resolveShellKey, type KeyPress, type ShellKeyMap } from "../src/hooks/useShellKeys";

interface Field {
  readonly id: string;
  readonly shown: boolean;
}

type Action = "live" | "library" | "player" | "settings" | "search" | "zoom-reset" | "close-events";

/* The shape of the interface's map: Ctrl+1..3 surfaces, Ctrl+, Settings, Ctrl+F search, Ctrl+0 under a window,
 * and Escape. */
const MAP: ShellKeyMap<Action> = {
  ctrl: { "1": "live", "2": "library", "3": "player", ",": "settings", f: "search" },
  ctrlAlways: { "0": "zoom-reset" },
  escape: "close-events",
};

const press = (over: Partial<KeyPress>): KeyPress => ({
  key: "",
  ctrl: false,
  alt: false,
  shift: false,
  defaultPrevented: false,
  composing: false,
  inTextField: false,
  ...over,
});

const CLOSED = { windowOpen: false, drawerOpen: false };
const WINDOW = { windowOpen: true, drawerOpen: false };
const DRAWER = { windowOpen: false, drawerOpen: true };

describe("the shell's key map (02 section 6)", () => {
  it("resolves Ctrl with a digit to its surface", () => {
    assert.equal(resolveShellKey(MAP, press({ key: "2", ctrl: true }), CLOSED), "library");
    assert.equal(resolveShellKey(MAP, press({ key: "3", ctrl: true }), CLOSED), "player");
  });

  it("resolves Ctrl+F in either case, and Ctrl+, to Settings", () => {
    assert.equal(resolveShellKey(MAP, press({ key: "F", ctrl: true }), CLOSED), "search");
    assert.equal(resolveShellKey(MAP, press({ key: ",", ctrl: true }), CLOSED), "settings");
  });

  it("lets Ctrl+0 reset the zoom under an open window, and yields the other Ctrl keys to it", () => {
    assert.equal(resolveShellKey(MAP, press({ key: "0", ctrl: true }), WINDOW), "zoom-reset");
    assert.equal(resolveShellKey(MAP, press({ key: "1", ctrl: true }), WINDOW), null);
    assert.equal(resolveShellKey(MAP, press({ key: "f", ctrl: true }), WINDOW), null);
  });

  it("ignores a text field for every key, Escape included", () => {
    assert.equal(resolveShellKey(MAP, press({ key: "1", ctrl: true, inTextField: true }), CLOSED), null);
    assert.equal(resolveShellKey(MAP, press({ key: "Escape", inTextField: true }), DRAWER), null);
  });

  it("ignores a composing or already handled press", () => {
    assert.equal(resolveShellKey(MAP, press({ key: "1", ctrl: true, composing: true }), CLOSED), null);
    assert.equal(resolveShellKey(MAP, press({ key: "1", ctrl: true, defaultPrevented: true }), CLOSED), null);
  });

  it("needs Ctrl without Alt or Shift, and resolves no unknown key", () => {
    assert.equal(resolveShellKey(MAP, press({ key: "1" }), CLOSED), null);
    assert.equal(resolveShellKey(MAP, press({ key: "1", ctrl: true, shift: true }), CLOSED), null);
    assert.equal(resolveShellKey(MAP, press({ key: "1", ctrl: true, alt: true }), CLOSED), null);
    assert.equal(resolveShellKey(MAP, press({ key: "9", ctrl: true }), CLOSED), null);
  });

  it("closes the events drawer on Escape only when no window is open", () => {
    assert.equal(resolveShellKey(MAP, press({ key: "Escape" }), DRAWER), "close-events");
    assert.equal(resolveShellKey(MAP, press({ key: "Escape" }), CLOSED), null);
    assert.equal(resolveShellKey(MAP, press({ key: "Escape" }), { windowOpen: true, drawerOpen: true }), null);
  });
});

describe("the active surface's search (Ctrl+F, 06 section 8)", () => {
  it("answers with the first field that is on screen, skipping the hidden surfaces", () => {
    const fields: Field[] = [
      { id: "live", shown: false },
      { id: "library", shown: true },
      { id: "player", shown: true },
    ];
    assert.equal(firstShown(fields, (field) => field.shown)?.id, "library");
  });

  it("answers with nothing when no field is on screen, so Ctrl+F does nothing", () => {
    const fields: Field[] = [{ id: "live", shown: false }];
    const none: Field[] = [];
    assert.equal(firstShown(fields, (field) => field.shown), undefined);
    assert.equal(firstShown(none, (field) => field.shown), undefined);
  });
});
