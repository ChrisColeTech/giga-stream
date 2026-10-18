import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, it } from "node:test";
import { Statusbar } from "@/components/chrome/Statusbar";
import { Titlebar } from "@/components/chrome/Titlebar";
import { SIDES, SURFACES, SURFACE_ORDER, paneKey } from "@/constants/surfaces";
import { barTone } from "@/lib/bar-tone";
import { useAppStore } from "@/store/app-store";
import type { PaneSide, Surface } from "@/types/shell";

const open = (surface: Surface, side: PaneSide): boolean => useAppStore.getState().open[paneKey(surface, side)] ?? true;
const pane = (side: PaneSide): boolean => open("player", side);

describe("Theatre mode", () => {
  beforeEach(() => {
    useAppStore.setState(useAppStore.getInitialState(), true);
    useAppStore.setState({ surface: "player" });
  });

  it("entering collapses the open panes of ALL surfaces in one update and sets theatre", () => {
    useAppStore.getState().togglePane("bottom");
    const sizes = { ...useAppStore.getState().sizes };
    const { openVersion, shellRevision } = useAppStore.getState();
    assert.equal(pane("left"), true);
    assert.equal(openVersion > 0, true);
    assert.equal(open("library", "left"), true, "another surface's pane is open before");

    useAppStore.getState().toggleTheatre();
    const after = useAppStore.getState();
    assert.equal(after.theatre, true);
    for (const surface of SURFACE_ORDER) {
      for (const side of SIDES) {
        if (SURFACES[surface].panes[side] === null) continue;
        assert.equal(open(surface, side), false, `${surface}.${side} is collapsed`);
      }
    }
    assert.equal(after.openVersion, openVersion + 1, "one open update");
    assert.equal(after.shellRevision, shellRevision + 1, "one shell revision");
    assert.deepEqual(after.sizes, sizes, "sizes are untouched");
  });

  it("never records a pane a surface does not have", () => {
    useAppStore.getState().toggleTheatre();
    assert.equal(paneKey("library", "bottom") in useAppStore.getState().open, false);
    assert.equal(paneKey("live", "bottom") in useAppStore.getState().open, false);
  });

  it("exiting changes only theatre and chromeIdle: the open map is identical, a hand-reopened pane included", () => {
    useAppStore.getState().toggleTheatre();
    useAppStore.getState().togglePane("left");
    useAppStore.getState().setChromeIdle(true);
    const before = useAppStore.getState();
    const openBefore = { ...before.open };

    useAppStore.getState().toggleTheatre();
    const after = useAppStore.getState();
    assert.equal(after.theatre, false);
    assert.equal(after.chromeIdle, false);
    assert.deepEqual(after.open, openBefore);
    assert.equal(pane("left"), true, "a pane reopened in Theatre stays open");
    assert.equal(after.openVersion, before.openVersion);
    assert.equal(after.shellRevision, before.shellRevision);
  });

  it("a second Theatre cycle never reopens anything", () => {
    useAppStore.getState().toggleTheatre();
    useAppStore.getState().toggleTheatre();
    const once = { ...useAppStore.getState().open };
    useAppStore.getState().toggleTheatre();
    useAppStore.getState().toggleTheatre();
    assert.deepEqual(useAppStore.getState().open, once);
    assert.equal(pane("left"), false);
    assert.equal(pane("right"), false);
    assert.equal(pane("bottom"), false);
  });

  it("renders the Theatre button in the titlebar, ghost, with a transitioned bar tone", () => {
    const normal = renderToStaticMarkup(createElement(Titlebar));
    assert.match(normal, /aria-label="Theatre mode"/);
    assert.match(normal, /aria-pressed="false"/);
    assert.match(normal, /MonitorPlay|lucide-monitor-play/);
    assert.ok(normal.includes(barTone(false)), "normal tone classes are present");
    assert.match(normal, /duration-fast/, "the colour change is a CSS transition, not a jump");
    /* Ghost titlebar (owner, 2026-10-17): every bar button is ghost; the nav track's own edge is not a button. */
    const ghostButtons = normal.match(/<button[^>]*aria-label="(Theatre mode|Toggle [a-z ]+)"[^>]*>/g) ?? [];
    assert.ok(ghostButtons.length >= 4, "three pane toggles and Theatre");
    for (const button of ghostButtons) {
      assert.match(button, /border-transparent bg-transparent/, `${button.slice(0, 60)}… is ghost`);
    }

    /* SSR reads the store's initial snapshot, so the theatre-on tone is asserted through the same pure
       decision both bars render with, and the behaviour test above proves `theatre` flips. */
    assert.equal(barTone(true), "border-black bg-black");
    assert.equal(barTone(false), "border-border bg-panel");
    assert.match(renderToStaticMarkup(createElement(Statusbar)), /duration-fast/);
  });

  it("sleeps the Theatre button while a child window is open: disabled, unselected, the tabs' wording", () => {
    useAppStore.setState({ overlay: "title-info" });
    const button = /<button[^>]*aria-label="Theatre mode"[^>]*>/
      .exec(renderToStaticMarkup(createElement(Titlebar)))?.[0] ?? "";
    assert.ok(button.includes("disabled"), "natively disabled, like the sleeping tabs and pane toggles");
    assert.ok(button.includes('aria-pressed="false"'), "reads unselected whatever Theatre is behind the window");
    assert.ok(button.includes("Close the open window to switch surfaces."), "the exact sleeping wording the tabs use");

    useAppStore.setState({ overlay: null });
    const awake = /<button[^>]*aria-label="Theatre mode"[^>]*>/
      .exec(renderToStaticMarkup(createElement(Titlebar)))?.[0] ?? "";
    assert.ok(!awake.includes("disabled"), "awake again once the window closed");
  });
});
