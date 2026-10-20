import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { on } from "@giga/ui/lib/bus";
import type { MenuItem } from "@giga/ui/menus/types";
import { LibraryBody } from "@/components/library/LibraryBody";
import { LibraryRail } from "@/components/library/LibraryRail";
import { openCardMenu, type CardMenuContext } from "@/components/library/card-menu";
import { useLibraryActions } from "@/hooks/useLibraryActions";
import type { ResolvedItem } from "@/lib/library-marks";
import { useAppStore } from "@/store/app-store";

const draw = (element: ReactElement): string => renderToStaticMarkup(element);

const item = (id: string): ResolvedItem => ({
  ref: { kind: "title", id },
  kind: "movie",
  title: `Title ${id}`,
  genres: ["Drama"],
  favorite: false,
  collectionIds: [],
  collectionSources: {},
});

const noop = (): void => undefined;

/** A `CardMenuContext` whose reads would fail loudly: signed out, none may be made. */
const signedOutContext = (): CardMenuContext => ({
  collections: [],
  signedIn: false,
  inHistory: false,
  onInfo: noop,
  onRemoveWatch: noop,
});

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});

afterEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});

describe("the Library's signed-out surfaces (`63` section 3.4)", () => {
  it("the rail unrenders History, the collections group and the Manage collections footer; All and Favorites stay", () => {
    const signedOut = draw(createElement(LibraryRail, {
      source: "all", signedIn: false, counts: { collections: {} }, collections: [], onSource: noop,
    }));
    assert.ok(signedOut.includes("All") && signedOut.includes("Favorites"));
    assert.ok(!signedOut.includes("History"));
    assert.ok(!signedOut.includes("Collections") && !signedOut.includes("Manage collections"));
    const signedIn = draw(createElement(LibraryRail, {
      source: "all", signedIn: true, counts: { collections: {} }, collections: [], onSource: noop,
    }));
    assert.ok(signedIn.includes("History") && signedIn.includes("Collections") && signedIn.includes("Manage collections"));
  });

  it("the body unrenders the History strip and the Continue strip signed out, whatever the query says", () => {
    const signedOut = draw(createElement(LibraryBody, {
      scope: ["movie"], source: "history", signedIn: false, showContinue: true, view: "grid",
      items: [item("a")], shown: [item("a")], continuing: [item("a")], collections: [], selected: null,
      toolbar: null, onSelect: noop, onRemoveWatch: noop, onClearHistory: noop,
      loading: false, paging: false, hasMore: false, onLoadMore: (): boolean => false, titleRegionsLoading: false,
    }));
    assert.ok(!signedOut.includes("Clear history"), "no HistoryStrip signed out");
    assert.ok(!signedOut.includes("Continue watching"), "no ContinueStrip signed out");
    const signedIn = draw(createElement(LibraryBody, {
      scope: ["movie"], source: "history", signedIn: true, showContinue: true, view: "grid",
      items: [item("a")], shown: [item("a")], continuing: [], collections: [], selected: null,
      toolbar: null, onSelect: noop, onRemoveWatch: noop, onClearHistory: noop,
      loading: false, paging: false, hasMore: false, onLoadMore: (): boolean => false, titleRegionsLoading: false,
    }));
    assert.ok(signedIn.includes("Clear history"));
  });

  it("the card menu signed out has no collection actions and asks nothing; the favorite heart stays, disabled", () => {
    globalThis.fetch = async () => {
      throw new Error("a signed-out card must ask nothing");
    };
    const rows: MenuItem[] = [];
    const stop = on("menu:open", (payload) => {
      const menu = payload as { items: MenuItem[] };
      rows.push(...menu.items);
    });
    try {
      openCardMenu(
        { clientX: 1, clientY: 1, preventDefault: noop, stopPropagation: noop },
        item("a"),
        signedOutContext(),
        useLibraryActions(),
      );
    } finally {
      stop();
    }
    const labels = rows.map((row) => (row.kind === "action" || row.kind === "submenu" ? row.label : row.kind));
    assert.ok(labels.includes("Play") && labels.includes("Info") && labels.includes("Favorite"));
    assert.ok(!labels.includes("Collections"), "no collection actions signed out");
    assert.ok(!labels.includes("Remove from History"));
    const favorite = rows.find((row) => row.kind === "action" && row.label === "Favorite");
    assert.ok(favorite?.kind === "action" && favorite.disabled === true);
    assert.equal(favorite.disabledReason, "Sign in to keep favorites.");
  });
});
