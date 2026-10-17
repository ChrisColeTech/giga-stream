import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PlayerStage, type PlayerStageProps } from "@/components/player/PlayerStage";
import { PlayerBrowser } from "@/components/player/PlayerBrowser";
import { PlayerInspector } from "@/components/player/PlayerInspector";
import { PlayerRelated } from "@/components/player/PlayerRelated";
import type { PlayerCommands } from "@/lib/player-commands";
import { viewOf } from "@/lib/player-view";
import { useAppStore } from "@/store/app-store";

const noop = () => undefined;
const commands: PlayerCommands = {
  retry: noop, resume: noop, startOver: noop, reveal: noop, close: noop,
  favorite: noop, toggleMember: noop, removeHistory: noop, openRelated: noop,
};
const view = viewOf({ current: null, season: undefined }, { favourites: {}, memberships: {} });
const props: PlayerStageProps = {
  view, commands, activeSource: undefined,
  startPositionMs: 0, retry: 0, userInitiated: false, loading: false, awaitingResume: false,
  playableUnitSelected: false, playableUnitResolved: false, noSourceReason: "No source",
  onState: noop, onProgress: noop, onPlaying: noop, onBoundary: noop, onPausedChange: noop,
};

describe("documented Player composition", () => {
  it("renders the idle player with native controls, no source and no authored overlay", () => {
    const html = renderToStaticMarkup(createElement(PlayerStage, props));
    assert.match(html, /<video\b/);
    assert.match(html, /controls=""/);
    assert.match(html, /preload="none"/);
    assert.doesNotMatch(html, /\ssrc=|<iframe|Nothing is open|Open Library|Choose an episode|role="status"/);
  });

  it("retains the source-less player while loading or waiting for an episode", () => {
    const tab = { id: "tv-1", ref: { kind: "title" as const, id: "tv-1" }, kind: "tv" as const, title: "Series" };
    for (const loading of [true, false]) {
      const html = renderToStaticMarkup(createElement(PlayerStage, { ...props, view: { ...view, tab }, loading }));
      assert.match(html, /<video\b/);
      assert.match(html, /controls=""/);
      assert.doesNotMatch(html, /\ssrc=|Choose an episode|role="status"/);
    }
  });

  it("renders idle panes as skeletons without fabricated controls or facts", () => {
    const browser = renderToStaticMarkup(createElement(PlayerBrowser, {
      view, loading: false, onSeason: noop, onEpisode: noop,
    }));
    const inspector = renderToStaticMarkup(createElement(PlayerInspector, {
      view, commands, paused: true, loading: false, sources: [], activeId: "", onSelect: noop,
    }));
    const related = renderToStaticMarkup(createElement(PlayerRelated, { view, commands, loading: false }));
    assert.match(inspector, />Overview</);
    assert.match(inspector, />Details</);
    assert.equal((inspector.match(/<button\b/g) ?? []).length, 4);
    assert.match(inspector, /disabled=""[^>]*>Resume</);
    assert.match(inspector, /disabled=""[^>]*>Start over</);
    assert.match(inspector, /Open a title or file first/);
    for (const html of [browser, inspector, related]) {
      assert.ok(html.length > 0);
      assert.doesNotMatch(html, /<select|Available after an item|Nothing is open|>Title<|>Year<|>Runtime</);
    }
  });

  it("omits sandbox and detects browser runtime from preload, not the fileserver host", () => {
    useAppStore.setState({ runtime: "electron" });
    try {
      const tab = { id: "movie-1", ref: { kind: "title" as const, id: "movie-1" }, kind: "movie" as const, title: "Film" };
      const embed = { providerId: 1, name: "Provider", url: "https://player.example/1", origin: "https://player.example", order: 1 };
      const source = { id: "provider:1", name: "Provider", kind: "embed" as const, embed };
      const html = renderToStaticMarkup(createElement(PlayerStage, {
        ...props, view: { ...view, tab }, activeSource: source,
        playableUnitSelected: true, playableUnitResolved: true,
      }));
      assert.doesNotMatch(html, /\ssandbox=/);
      assert.doesNotMatch(html, /unprotected|<select/);
    } finally { useAppStore.setState({ runtime: null }); }
  });

  it("keeps both footer actions visible during playback and under automatic resume preferences", () => {
    const previous = useAppStore.getState();
    try {
      for (const resumeMode of ["ask", "resume", "restart"] as const) {
        useAppStore.setState({ playback: { ...previous.playback, resumeMode } });
        const html = renderToStaticMarkup(createElement(PlayerInspector, {
          view, commands, paused: false, loading: false, sources: [], activeId: "", onSelect: noop,
        }));
        assert.match(html, />Resume<\/button>/);
        assert.match(html, />Start over<\/button>/);
      }
    } finally { useAppStore.setState({ playback: previous.playback }); }
  });

  it("places Source in the inspector footer before Resume and Start over", () => {
    const sources = [
      { id: "a", kind: "stream" as const, name: "Source A", url: "https://a.example/video.mp4" },
      { id: "b", kind: "stream" as const, name: "Source B", url: "https://b.example/video.mp4" },
    ];
    const html = renderToStaticMarkup(createElement(PlayerInspector, {
      view, commands, paused: true, loading: false, sources, activeId: "a", onSelect: noop,
    }));
    assert.match(html, /aria-label="Source"/);
    assert.ok(html.indexOf('aria-label="Source"') > html.indexOf('role="status"'));
    assert.ok(html.indexOf('aria-label="Source"') < html.indexOf('>Resume</button>'));
  });
});
