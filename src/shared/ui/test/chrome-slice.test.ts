import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createChromeSlice, type ChromeOptions } from "../src/store/chrome-slice";
import type { ChromeKinds, ChromeSlice } from "../src/store/chrome-types";

interface Kinds extends ChromeKinds {
  area: "Connection" | "Scan";
  overlay: "settings" | "collections";
  anchor: { readonly x: number; readonly y: number } | null;
  item: string;
  box: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
}

/* A store made of the slice itself: `set` merges into the one object, `get` returns it. The clock is the test's. */
function makeStore(overrides: Partial<ChromeOptions<Kinds>> = {}): { state: ChromeSlice<Kinds> } {
  const options: ChromeOptions<Kinds> = {
    defaults: { theme: "dark", accent: "amber", motion: "system", uiZoom: 1 },
    defaultArea: "Connection",
    now: () => 1000,
    ...overrides,
  };
  const state: ChromeSlice<Kinds> = createChromeSlice<Kinds>(
    (partial) => Object.assign(state, partial),
    () => state,
    options,
  );
  return { state };
}

describe("the chrome slice: defaults", () => {
  it("starts from the program's defaults, with an empty log and no notice", () => {
    const { state } = makeStore();
    assert.equal(state.theme, "dark");
    assert.equal(state.accent, "amber");
    assert.equal(state.motion, "system");
    assert.equal(state.uiZoom, 1);
    assert.equal(state.eventsOpen, false);
    assert.equal(state.notice, null);
    assert.deepEqual(state.events, []);
  });

  it("starts with the rows a program gives it", () => {
    const { state } = makeStore({
      events: [{ id: "seed", at: 1, tone: "info", area: "Scan", sentence: "Seeded." }],
    });
    assert.equal(state.events.length, 1);
    assert.equal(state.events[0]?.sentence, "Seeded.");
  });
});

describe("the chrome slice: notices and the events log", () => {
  it("puts an info sentence in the drawer's rows and never on the notice line", () => {
    const { state } = makeStore();
    state.say("Zoom reset to 100%.");
    assert.equal(state.notice, null);
    assert.equal(state.events.length, 1);
    assert.equal(state.events[0]?.tone, "info");
    assert.equal(state.events[0]?.area, "Connection");
    assert.equal(state.events[0]?.sentence, "Zoom reset to 100%.");
    assert.equal(state.events[0]?.at, 1000);
  });

  it("logs a warn or an error as a row in the default area AND on the notice line", () => {
    const { state } = makeStore();
    state.say("Could not reach the fileserver.", "warn");
    assert.equal(state.notice?.tone, "warn");
    assert.equal(state.notice?.sentence, "Could not reach the fileserver.");
    assert.equal(state.events.length, 1);
    assert.equal(state.events[0]?.tone, "warn");
    assert.equal(state.events[0]?.area, "Connection");
    assert.equal(state.events[0]?.sentence, "Could not reach the fileserver.");
    assert.equal(state.events[0]?.at, 1000);
  });

  it("logs a warn or an error into the area it names", () => {
    const { state } = makeStore();
    state.say("No folder was selected.", "error", "Scan");
    assert.equal(state.events[0]?.area, "Scan");
    assert.equal(state.events[0]?.tone, "error");
  });

  it("an info sentence leaves an earlier notice alone", () => {
    const { state } = makeStore();
    state.say("Refused.", "warn");
    state.say("Created x.");
    assert.deepEqual(state.notice, { sentence: "Refused.", tone: "warn", serial: 1 });
    assert.equal(state.events.length, 2);
    assert.equal(state.events[1]?.tone, "info");
  });

  it("bumps the notice serial on a warn, so an identical refusal is announced again", () => {
    const { state } = makeStore();
    state.say("Refused.", "warn");
    state.say("Refused.", "warn");
    assert.equal(state.notice?.serial, 2);
  });

  it("keeps the newest 200 rows and drops the oldest", () => {
    const { state } = makeStore();
    for (let index = 0; index < 205; index += 1) {
      state.logEvent({ tone: "info", area: "Connection", sentence: `row ${index}` });
    }
    assert.equal(state.events.length, 200);
    assert.equal(state.events[0]?.sentence, "row 5");
    assert.equal(state.events.at(-1)?.sentence, "row 204");
  });

  it("clears the log and keeps the notice", () => {
    const { state } = makeStore();
    state.say("Failed.", "warn");
    state.clearEvents();
    assert.deepEqual(state.events, []);
    assert.equal(state.notice?.sentence, "Failed.");
  });
});

describe("the chrome slice: settings, overlays and folds", () => {
  it("clamps the zoom between 0.5 and 3", () => {
    const { state } = makeStore();
    state.setZoom(9);
    assert.equal(state.uiZoom, 3);
    state.setZoom(0.1);
    assert.equal(state.uiZoom, 0.5);
    state.setZoom(1.5);
    assert.equal(state.uiZoom, 1.5);
  });

  it("writes the theme, the accent and the motion preference", () => {
    const { state } = makeStore();
    state.setTheme("light");
    state.setAccent("violet");
    state.setMotion("on");
    assert.equal(state.theme, "light");
    assert.equal(state.accent, "violet");
    assert.equal(state.motion, "on");
  });

  it("opens one overlay with its anchor and item, and closes it back to nothing", () => {
    const { state } = makeStore();
    state.openOverlay("collections", { x: 4, y: 8 }, "title-7");
    assert.equal(state.overlay, "collections");
    assert.deepEqual(state.overlayAnchor, { x: 4, y: 8 });
    assert.equal(state.overlayItem, "title-7");
    state.closeOverlay();
    assert.equal(state.overlay, null);
    assert.equal(state.overlayAnchor, null);
    assert.equal(state.overlayItem, null);
  });

  it("toggles the events drawer", () => {
    const { state } = makeStore();
    state.toggleEvents();
    assert.equal(state.eventsOpen, true);
    state.toggleEvents();
    assert.equal(state.eventsOpen, false);
  });

  it("remembers the last box of each child window by key", () => {
    const { state } = makeStore();
    state.rememberChild("settings", { x: 1, y: 2, width: 300, height: 200 });
    state.rememberChild("settings", { x: 5, y: 6, width: 310, height: 220 });
    assert.deepEqual(state.childBounds.settings, { x: 5, y: 6, width: 310, height: 220 });
  });

  it("remembers which child windows were maximized, by key, apart from their normal boxes", () => {
    const { state } = makeStore();
    state.rememberChild("preview", { x: 1, y: 2, width: 300, height: 200 });
    state.rememberMaximized("preview", true);
    state.rememberMaximized("settings", true);
    state.rememberMaximized("settings", false);
    assert.deepEqual(state.childMaximized, { preview: true, settings: false });
    assert.deepEqual(state.childBounds.preview, { x: 1, y: 2, width: 300, height: 200 });
  });

  it("flips a fold by id and keeps each id on its own", () => {
    const { state } = makeStore();
    state.toggleFold("appearance");
    assert.equal(state.folded.appearance, true);
    assert.equal(state.folded.playback, undefined);
    state.toggleFold("appearance");
    assert.equal(state.folded.appearance, false);
  });
});
