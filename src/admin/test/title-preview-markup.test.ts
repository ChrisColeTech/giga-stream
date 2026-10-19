import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { createElement } from "react";
import { OverlayHost } from "@/components/overlays/OverlayHost";
import { TitlePreviewWindow } from "@/components/titles/TitlePreviewWindow";
import { PREVIEW_TITLE_TOOLTIP, UNREACHABLE_REASON } from "@/constants/title-copy";
import type { AdminTitleDetail } from "@/services/schemas/title-schema";
import { useAppStore } from "@/store/app-store";
import { renderLive, resetStore, signInForTest } from "./support/store";

/* The title preview window (`55` decision 8), drawn statically: the toolbar's `Enabled` labelled switch and `Provider`
 *  select, the iframe by the interface's embed rules, the status bar's words. A movie's sources come from the held
 *  detail at once; a series' need the seasons read, which a static render never runs (`lib/title-preview-state`'s own
 *  tests cover that narrowing). */

const state = () => useAppStore.getState();
const count = (html: string, needle: string): number => html.split(needle).length - 1;
const at = (html: string, text: string): number => {
  const index = html.indexOf(text);
  assert.ok(index >= 0, `missing: ${text}`);
  return index;
};

const detail = (id: string, extra: Partial<AdminTitleDetail> = {}): AdminTitleDetail => ({
  id,
  kind: "movie",
  title: `T ${id}`,
  year: 1999,
  state: "synced",
  enabled: true,
  tmdbId: 603,
  ...extra,
});

const open = (held: AdminTitleDetail): string => {
  state().titlesReset(state().serial);
  state().titleDetailStart(held.id);
  state().titleDetailLoaded(held);
  state().titlesOpenPreview(held.id);
  state().openOverlay("title-preview");
  return renderLive(createElement(TitlePreviewWindow));
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

describe("the title preview window", () => {
  it("is titled by the title, and carries its `Enabled` switch and a `Provider` select of the movie's own sources", () => {
    const html = open(
      detail("movie-1", {
        enabled: false,
        sources: [
          { name: "VidSrc", url: "https://vidsrc.sh/embed/movie/603" },
          { name: "Broken" },
          { name: "VixSrc", url: "https://vixsrc.to/movie/603", providerId: 22 },
        ],
      }),
    );
    assert.ok(/<h2[^>]*>T movie-1<\/h2>/.test(html), "the title bar is the title's name");
    assert.ok(html.includes('aria-label="T movie-1 window"') && html.includes('aria-label="Close T movie-1"'));
    const toolbar = html.slice(0, at(html, "<iframe"));
    assert.ok(at(toolbar, 'aria-label="Enabled"') < at(toolbar, 'aria-label="Provider"'), "the switch, then the select");
    assert.ok(toolbar.includes(">Enabled</span>") && toolbar.includes(">Provider</span>"));
    assert.ok(toolbar.includes('aria-checked="false"'), "the title's own `enabled`");
    const options = [...toolbar.matchAll(/<option value="([^"]+)"/g)].map((hit) => hit[1]);
    assert.deepEqual(options, ["https://vidsrc.sh/embed/movie/603", "22"], "an unreadable source costs itself only");
    assert.match(toolbar, /<option value="https:\/\/vidsrc\.sh\/embed\/movie\/603" selected="">/);
  });

  it("plays the chosen source in an iframe by the interface's embed rules, following no walk", () => {
    const html = open(detail("movie-1", { sources: [{ name: "VidSrc", url: "https://vidsrc.sh/embed/movie/603" }] }));
    assert.ok(
      html.includes('allow="autoplay; fullscreen; encrypted-media; picture-in-picture"') &&
        html.includes('allowFullScreen=""') &&
        html.includes('referrerPolicy="origin"'),
      "the embed host's frame rules",
    );
    assert.ok(!html.includes("sandbox"), "a provider iframe has NO sandbox attribute (owner, 2026-10-17)");
    assert.match(html, /<iframe[^>]*src="about:blank"/);
    assert.ok(html.includes('title="T movie-1 player"') && html.includes("bg-stage"));
    assert.ok(!html.includes('aria-label="Previous"') && !html.includes('aria-label="Next"'), "no walk: the choice is the window's");
  });

  it("says `ready` with the chosen source's name in the status bar, under the stage", () => {
    const html = open(detail("movie-1", { sources: [{ name: "VidSrc", url: "https://vidsrc.sh/embed/movie/603" }] }));
    const bar = html.slice(at(html, "data-child-status"));
    assert.ok(at(html, "data-child-status") > html.indexOf("</iframe>"), "the status bar is the last row, under the stage");
    assert.match(bar, /role="status"[\s\S]*>ready</);
    assert.ok(bar.includes(">VidSrc<"), "the chosen source's name, right");
    const below = html.slice(html.indexOf("</iframe>"));
    assert.ok(!below.includes("<button"), "no controls under the stage");
  });

  it("says `loading` while the detail is still being read, with the select disabled for its reason", () => {
    state().titlesReset(state().serial);
    state().titlesOpenPreview("movie-1");
    state().openOverlay("title-preview");
    const html = renderLive(createElement(TitlePreviewWindow));
    assert.match(html, /role="status"[\s\S]*>loading</);
    assert.ok(html.includes("Enabled. Loading.") && html.includes("Provider. Loading."));
    assert.ok(html.includes("animate-skel-shimmer"), "the stage waits under its skeleton");
  });

  it("says `no source` and disables the select with its reason when no provider gives one", () => {
    const html = open(detail("movie-1", { sources: [] }));
    assert.match(html, /role="status"[\s\S]*>no source</);
    assert.ok(html.includes("Provider. No provider gives this title a source."));
    assert.ok(!html.includes("<option"), "nothing to choose");
  });

  it("says `loading` for a series while its first season's episodes are read", () => {
    const html = open(detail("tv-1", { kind: "tv", seasons: [{ season: 2, episodeCount: 8 }] }));
    assert.match(html, /role="status"[\s\S]*>loading</);
    assert.ok(html.includes("Provider. Loading."), "the season read has not answered");
  });

  it("says `missing` when the detail read failed, and disables the switch with its reason", () => {
    state().titlesReset(state().serial);
    state().titleDetailStart("movie-1");
    state().titleDetailFailed("movie-1");
    state().titlesOpenPreview("movie-1");
    state().openOverlay("title-preview");
    const html = renderLive(createElement(TitlePreviewWindow));
    assert.match(html, /role="status"[\s\S]*>missing</);
    assert.ok(html.includes("Enabled. That title no longer exists."));
  });

  it("is the one open flow: the host mounts it for `title-preview`, replacing a provider preview", () => {
    state().providersOpenPreview(1);
    state().openOverlay("provider-preview");
    state().titlesOpenPreview("movie-1");
    state().openOverlay("title-preview");
    assert.equal(state().overlay, "title-preview");
    assert.equal(count(renderLive(createElement(OverlayHost)), 'data-child-window="title-preview@2"'), 1);
  });

  it("takes the request value with a raised serial at every open", () => {
    state().titlesReset(state().serial);
    state().titlesOpenPreview("movie-1");
    assert.deepEqual(state().titles.preview, { titleId: "movie-1", serial: 1, opened: 1 });
    state().titlesOpenPreview("movie-2");
    assert.deepEqual(state().titles.preview, { titleId: "movie-2", serial: 2, opened: 2 });
  });

  it("disables the switch with the unreachable reason while the backend cannot be reached", () => {
    state().titlesReset(state().serial);
    state().titlesMarkUnreachable(true);
    state().titleDetailStart("movie-1");
    state().titleDetailLoaded(detail("movie-1", { sources: [{ name: "VidSrc", url: "https://v.test" }] }));
    state().titlesOpenPreview("movie-1");
    state().openOverlay("title-preview");
    const html = renderLive(createElement(TitlePreviewWindow));
    assert.ok(html.includes(`Enabled. ${UNREACHABLE_REASON}`));
  });
});

describe("the eye's tooltip", () => {
  it("is the preview verb's own words, never the channels'", () => {
    assert.equal(PREVIEW_TITLE_TOOLTIP, "Preview title");
  });
});