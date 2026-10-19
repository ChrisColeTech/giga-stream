import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { createElement } from "react";
import { OverlayHost } from "@/components/overlays/OverlayHost";
import { ProviderPreviewWindow } from "@/components/providers/ProviderPreviewWindow";
import { NO_PREVIEW_TITLE, PREVIEW_PROVIDER_TOOLTIP, UNREACHABLE_REASON } from "@/constants/provider-copy";
import { START_STORED, storedKey } from "@/lib/title-stored-query";
import type { AdminProvider } from "@/services/schemas/provider-schema";
import type { AdminTitleRow } from "@/services/schemas/title-schema";
import { useAppStore } from "@/store/app-store";
import { INVENTORY, titleRowOf } from "./support/titles-stored-kit";
import { renderLive, resetStore, signInForTest } from "./support/store";

/* The provider preview window (`55` decision 7), drawn statically: the toolbar's `Enabled` labelled switch and `Title`
 *  select, the iframe by the interface's embed rules, the status bar's words. The frame's ADDRESS is set imperatively
 *  from the mount callback (`lib/embed-frame`'s own tests cover it), so the static markup rests at `about:blank`. */

const state = () => useAppStore.getState();
const count = (html: string, needle: string): number => html.split(needle).length - 1;
const at = (html: string, text: string): number => {
  const index = html.indexOf(text);
  assert.ok(index >= 0, `missing: ${text}`);
  return index;
};

const provider = (id: number, extra: Partial<AdminProvider> = {}): AdminProvider => ({
  id,
  name: `Prov${id}`,
  source: "vidsrc",
  is_active: true,
  order: id,
  family: "embed",
  movieTemplate: "https://vidsrc.sh/embed/movie/{tmdbId}",
  origin: "https://vidsrc.sh",
  frameOrigins: ["https://vidsrc.sh"],
  created_at: "2026-10-01T09:00:00.000Z",
  ...extra,
});

const titleRow = (id: string, extra: Partial<AdminTitleRow> = {}): AdminTitleRow =>
  titleRowOf(id, { tmdbId: 603, ...extra });

/** Holds one page of stored titles (movies with TMDB ids, a series, an id-less movie). */
function holdTitles(rows: readonly AdminTitleRow[], total = rows.length): void {
  state().storedPageLoaded(storedKey(START_STORED), 0, {
    rows,
    total,
    version: "5:1",
    inventory: INVENTORY,
  });
}

const open = (id: number): string => {
  state().providersOpenPreview(id);
  state().openOverlay("provider-preview");
  return renderLive(createElement(ProviderPreviewWindow));
};

beforeEach(() => {
  resetStore();
  signInForTest();
});

/* The window reads the viewport and listens for its resize; the server render has no DOM, so a stub stands in. */
before(() => {
  const none = (): void => undefined;
  Reflect.set(globalThis, "window", { innerWidth: 1600, innerHeight: 1000, addEventListener: none, removeEventListener: none });
});
after(() => {
  Reflect.deleteProperty(globalThis, "window");
});

describe("the provider preview window", () => {
  it("is titled by the provider, and carries its own `Enabled` switch and a `Title` select of the stored movies", () => {
    state().providersReset(state().serial);
    state().providersLoaded([provider(1, { is_active: false })]);
    holdTitles([
      titleRow("movie-603"),
      titleRow("tv-1399", { kind: "tv" }),
      titleRow("movie-none", { tmdbId: undefined }),
      titleRow("movie-100"),
    ]);
    const html = open(1);
    assert.ok(/<h2[^>]*>Prov1<\/h2>/.test(html), "the title bar is the provider's name");
    assert.ok(html.includes('aria-label="Prov1 window"') && html.includes('aria-label="Close Prov1"'));
    assert.ok(html.includes('aria-label="Maximize Prov1"'));
    const toolbar = html.slice(0, at(html, "<iframe"));
    assert.ok(at(toolbar, 'aria-label="Enabled"') < at(toolbar, 'aria-label="Title"'), "the switch, then the select");
    assert.ok(toolbar.includes(">Enabled</span>") && toolbar.includes(">Title</span>"));
    assert.ok(toolbar.includes('aria-checked="false"'), "the provider's own `is_active`");
    const options = [...toolbar.matchAll(/<option value="([^"]+)"/g)].map((hit) => hit[1]);
    assert.deepEqual(options, ["movie-603", "movie-100"], "only stored movies with a TMDB id, in the list's order");
    assert.match(toolbar, /<option value="movie-603" selected="">/);
    assert.ok(!toolbar.includes(">Enable</button>") && !toolbar.includes(">Disable</button>"), "no prose verb");
  });

  it("plays the filled template in an iframe by the interface's embed rules: allow list, no sandbox, about:blank at rest", () => {
    state().providersReset(state().serial);
    state().providersLoaded([provider(1)]);
    holdTitles([titleRow("movie-603")]);
    const html = open(1);
    assert.ok(
      html.includes('allow="autoplay; fullscreen; encrypted-media; picture-in-picture"') &&
        html.includes('allowfullscreen=""') &&
        html.includes('referrerpolicy="origin"'),
      "the embed host's frame rules",
    );
    assert.ok(!html.includes("sandbox"), "a provider iframe has NO sandbox attribute (owner, 2026-10-17)");
    assert.match(html, /<iframe[^>]*src="about:blank"/);
    assert.ok(html.includes('title="Prov1 player"') && html.includes("bg-stage"));
  });

  it("says `ready` with the chosen title's name in the status bar, under the stage", () => {
    state().providersReset(state().serial);
    state().providersLoaded([provider(1)]);
    holdTitles([titleRow("movie-603"), titleRow("movie-100")]);
    const html = open(1);
    const bar = html.slice(at(html, "data-child-status"));
    assert.ok(at(html, "data-child-status") > html.indexOf("</iframe>"), "the status bar is the last row, under the stage");
    assert.match(bar, /role="status"[\s\S]*>ready</);
    assert.ok(bar.includes(">T movie-603<"), "the default chosen title's name, right");
    const below = html.slice(html.indexOf("</iframe>"));
    assert.ok(!below.includes("<button"), "no controls under the stage");
  });

  it("says `loading` while the stored titles are read, disables the select with its reason, and wears the skeleton", () => {
    state().providersReset(state().serial);
    state().providersLoaded([provider(1)]);
    const html = open(1);
    assert.match(html, /role="status"[\s\S]*>loading</);
    assert.ok(html.includes("Title. Loading."), "the select waits with its reason");
    assert.ok(html.includes("animate-skel-shimmer"), "the stage waits under its skeleton");
  });

  it("says `no title` and disables the select with its reason when no held stored movie has a TMDB id", () => {
    state().providersReset(state().serial);
    state().providersLoaded([provider(1)]);
    holdTitles([titleRow("tv-1399", { kind: "tv" }), titleRow("movie-none", { tmdbId: undefined })]);
    const html = open(1);
    assert.match(html, /role="status"[\s\S]*>no title</);
    assert.ok(html.includes(`Title. ${NO_PREVIEW_TITLE}`));
    assert.ok(!html.includes("<option"), "nothing to choose");
  });

  it("says `missing` when the provider is gone, and disables the switch with its reason", () => {
    state().providersReset(state().serial);
    state().providersLoaded([provider(1)]);
    holdTitles([titleRow("movie-603")]);
    state().providerRemove(1);
    const html = open(1);
    assert.match(html, /role="status"[\s\S]*>missing</);
    assert.ok(html.includes("Enabled. That provider no longer exists."));
  });

  it("is the one open flow: the host mounts it for `provider-preview`, replacing Settings", () => {
    state().openOverlay("settings");
    state().providersOpenPreview(1);
    state().openOverlay("provider-preview");
    assert.equal(state().overlay, "provider-preview");
    assert.equal(count(renderLive(createElement(OverlayHost)), 'data-child-window="provider-preview@2"'), 1);
  });

  it("opens through the eye's own entry: the request value, its serial raised at every open", () => {
    state().providersReset(state().serial);
    state().providersLoaded([provider(1)]);
    state().providersOpenPreview(1);
    assert.deepEqual(state().providers.preview, { providerId: 1, serial: 1, opened: 1 });
    state().providersOpenPreview(1);
    assert.deepEqual(state().providers.preview, { providerId: 1, serial: 2, opened: 2 });
  });

  it("disables the switch with the unreachable reason while the backend cannot be reached", () => {
    state().providersReset(state().serial);
    state().providersLoaded([provider(1)]);
    holdTitles([titleRow("movie-603")]);
    state().providersMarkUnreachable(true);
    const html = open(1);
    assert.ok(html.includes(`Enabled. ${UNREACHABLE_REASON}`) && html.includes(`Title. ${UNREACHABLE_REASON}`));
  });
});

describe("the eye's tooltip", () => {
  it("is the preview verb's own words, never the channels'", () => {
    assert.equal(PREVIEW_PROVIDER_TOOLTIP, "Preview provider");
  });
});