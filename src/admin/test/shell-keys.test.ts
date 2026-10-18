import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { resolveShellKey, type KeyPress, type ShellKeyContext } from "@giga/ui/hooks/useShellKeys";
import { SHELL_KEYS } from "@/constants/shell-keys";
import { TAB_ORDER } from "@/constants/tabs";
import { runShellAction } from "@/lib/shell-actions";
import { useAppStore } from "@/store/app-store";
import { signInForTest } from "./support/store";

const IDLE: ShellKeyContext = { windowOpen: false, drawerOpen: false };
const press = (key: string, extra: Partial<KeyPress> = {}): KeyPress => ({
  key,
  ctrl: true,
  alt: false,
  shift: false,
  defaultPrevented: false,
  composing: false,
  inTextField: false,
  ...extra,
});
const resolve = (key: string, context: ShellKeyContext = IDLE, extra: Partial<KeyPress> = {}) =>
  resolveShellKey(SHELL_KEYS, press(key, extra), context);

const state = () => useAppStore.getState();

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
  signInForTest();
});

describe("the admin's key map", () => {
  it("picks the tabs with Ctrl+1 to Ctrl+6, in the pill's order", () => {
    TAB_ORDER.forEach((tab, index) => assert.equal(resolve(String(index + 1)), tab));
    assert.equal(resolve("7"), null);
  });

  it("opens Settings with Ctrl+comma, finds the search with Ctrl+F and resets the zoom with Ctrl+0", () => {
    assert.equal(resolve(","), "settings");
    assert.equal(resolve("f"), "search");
    assert.equal(resolve("F"), "search");
    assert.equal(resolve("0"), "zoom-reset");
  });

  it("closes the events drawer with Escape only while it is open and no window is", () => {
    const drawer = { windowOpen: false, drawerOpen: true };
    assert.equal(resolve("Escape", drawer, { ctrl: false }), "close-events");
    assert.equal(resolve("Escape", IDLE, { ctrl: false }), null, "nothing to close");
    assert.equal(resolve("Escape", { windowOpen: true, drawerOpen: true }, { ctrl: false }), null, "the window owns Escape");
  });

  it("ignores every key while a text field has it, and while an IME composes", () => {
    for (const key of ["1", ",", "f", "0"]) {
      assert.equal(resolve(key, IDLE, { inTextField: true }), null, key);
      assert.equal(resolve(key, IDLE, { composing: true }), null, key);
    }
    assert.equal(resolve("Escape", { windowOpen: false, drawerOpen: true }, { ctrl: false, inTextField: true }), null);
  });

  it("yields to a modal window: only Ctrl+0 still works under it", () => {
    const modal = { windowOpen: true, drawerOpen: false };
    for (const key of ["1", "6", ",", "f"]) assert.equal(resolve(key, modal), null, key);
    assert.equal(resolve("0", modal), "zoom-reset");
  });

  it("wants the Ctrl key alone: Alt or Shift, or no Ctrl, is not a shell key", () => {
    assert.equal(resolve("1", IDLE, { alt: true }), null);
    assert.equal(resolve("1", IDLE, { shift: true }), null);
    assert.equal(resolve("1", IDLE, { ctrl: false }), null);
    assert.equal(resolve("1", IDLE, { defaultPrevented: true }), null);
  });
});

describe("what a shell key does", () => {
  it("shows the tab", () => {
    assert.equal(runShellAction("jobs", state()), true);
    assert.equal(state().tab, "jobs");
  });

  it("does nothing, and does not claim the press, while signed out", () => {
    state().signOut();
    assert.equal(runShellAction("jobs", state()), false);
    assert.equal(state().tab, "channels");
  });

  it("opens Settings", () => {
    assert.equal(runShellAction("settings", state()), true);
    assert.equal(state().overlay, "settings");
  });

  it("resets the zoom, silently (`50` section 2.1), under a window too", () => {
    state().setZoom(1.6);
    state().openOverlay("settings");
    assert.equal(runShellAction("zoom-reset", state()), true);
    assert.equal(state().uiZoom, 1);
    assert.equal(state().events.length, 0, "no `Zoom reset` row: the zoom is its own feedback");
  });

  it("toggles the events drawer", () => {
    state().toggleEvents();
    assert.equal(state().eventsOpen, true);
    assert.equal(runShellAction("close-events", state()), true);
    assert.equal(state().eventsOpen, false);
  });
});
