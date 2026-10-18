import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, it } from "node:test";
import { Button } from "@giga/ui/controls/Button";
import { Statusbar } from "@/components/chrome/Statusbar";
import { theatreButtonProps, Titlebar } from "@/components/chrome/Titlebar";
import { SIDES, SURFACES, SURFACE_ORDER, paneKey } from "@/constants/surfaces";
import { barTone } from "@/lib/bar-tone";
import { useAppStore } from "@/store/app-store";
import type { PaneSide, Surface } from "@/types/shell";

const noop = (): void => undefined;
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
    /* SSR renders the store's INITIAL snapshot (zustand v5 serves getInitialState on the server), so the sleeping
       carriage is asserted through the very props the titlebar builds when `useWorkSurfaceOpen` is true — the same
       pure-decision approach the theatre-tone assertion uses above — at the place the family really renders the
       words: Button's `reason`, the focusable tooltip group labelled "Verb. reason". */
    const asleep = renderToStaticMarkup(createElement(Button, theatreButtonProps(true, false, noop), "Theatre"));
    assert.ok(asleep.startsWith("<span"), "the reason's tooltip wrapper is the root");
    assert.ok(asleep.includes('role="group"') && asleep.includes('tabindex="0"'),
      "the group takes the focus the disabled button cannot");
    assert.ok(asleep.includes("aria-describedby"));
    assert.ok(asleep.includes('aria-label="Theatre mode. Close the open window to switch surfaces."'),
      "the exact sleeping wording the tabs use, in the group's label");
    const tag = /<button[^>]*>/.exec(asleep)?.[0] ?? "";
    assert.ok(/\sdisabled=""[\s>]/.test(tag), "natively disabled, like the sleeping tabs and pane toggles");
    assert.ok(tag.includes('aria-pressed="false"'), "reads unselected whatever Theatre is behind the window");
    assert.ok(!tag.includes("title="), "the words are the tooltip, not the browser title a disabled button hides");
  });

  it("awake, the Theatre button keeps its own title, no reason wrapper and no disabled attribute", () => {
    const awake = renderToStaticMarkup(createElement(Button, theatreButtonProps(false, false, noop), "Theatre"));
    assert.ok(awake.startsWith("<button"), "no wrapper");
    assert.ok(!awake.includes('role="group"') && !awake.includes("aria-describedby"));
    const tag = /<button[^>]*>/.exec(awake)?.[0] ?? "";
    assert.ok(tag.includes('title="Theatre mode"'));
    assert.ok(!/\sdisabled(="")?[\s>]/.test(tag), "no native disabled");
    assert.ok(tag.includes('aria-pressed="false"'));
  });
});
