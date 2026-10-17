import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, it } from "node:test";
import { Statusbar } from "@/components/chrome/Statusbar";
import { Titlebar } from "@/components/chrome/Titlebar";
import { paneKey } from "@/constants/surfaces";
import { barTone } from "@/lib/bar-tone";
import { useAppStore } from "@/store/app-store";
import type { PaneSide } from "@/types/shell";

const pane = (side: PaneSide): boolean => useAppStore.getState().open[paneKey("player", side)] ?? true;

describe("Theatre mode", () => {
  beforeEach(() => {
    useAppStore.setState(useAppStore.getInitialState(), true);
    useAppStore.setState({ surface: "player" });
  });

  it("entering collapses the open panes of the surface and sets theatre", () => {
    useAppStore.getState().togglePane("bottom");
    const sizes = { ...useAppStore.getState().sizes };
    assert.equal(pane("left"), true);
    assert.equal(pane("right"), true);
    assert.equal(pane("bottom"), false);

    useAppStore.getState().toggleTheatre();
    assert.equal(useAppStore.getState().theatre, true);
    assert.equal(pane("left"), false);
    assert.equal(pane("right"), false);
    assert.equal(pane("bottom"), false, "already closed stays closed");
    assert.deepEqual(useAppStore.getState().sizes, sizes, "sizes are untouched");
  });

  it("leaves a pane the surface does not have untouched", () => {
    useAppStore.setState({ surface: "library" });
    const before = { ...useAppStore.getState().open };
    useAppStore.getState().toggleTheatre();
    assert.equal(useAppStore.getState().open[paneKey("library", "bottom")], before[paneKey("library", "bottom")]);
    assert.equal(useAppStore.getState().open[paneKey("player", "left")], before[paneKey("player", "left")]);
    assert.equal(useAppStore.getState().open[paneKey("library", "left")], false);
  });

  it("exiting only clears theatre and chromeIdle: every pane stays as it is at that moment", () => {
    useAppStore.getState().toggleTheatre();
    useAppStore.getState().togglePane("left");
    useAppStore.getState().setChromeIdle(true);
    const revision = useAppStore.getState().shellRevision;

    useAppStore.getState().toggleTheatre();
    assert.equal(useAppStore.getState().theatre, false);
    assert.equal(useAppStore.getState().chromeIdle, false);
    assert.equal(pane("left"), true, "a pane reopened in Theatre stays open");
    assert.equal(pane("right"), false, "a pane still closed stays closed");
    assert.equal(pane("bottom"), false);
    assert.equal(useAppStore.getState().shellRevision, revision, "no pane was toggled on exit");
  });

  it("toggling twice does not reopen the panes", () => {
    useAppStore.getState().toggleTheatre();
    useAppStore.getState().toggleTheatre();
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
});
