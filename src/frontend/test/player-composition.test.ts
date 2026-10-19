import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PlayerStage, type PlayerStageProps } from "@/components/player/PlayerStage";
import { PlayerBrowser } from "@/components/player/PlayerBrowser";
import { PlayerInspector } from "@/components/player/PlayerInspector";
import { PlayerRelated } from "@/components/player/PlayerRelated";
import type { PlayerCommands } from "@/lib/player-commands";
import type { EpisodeAdjacency } from "@/lib/episode-adjacency";
import { viewOf } from "@/lib/player-view";
import { useAppStore } from "@/store/app-store";

const noop = () => undefined;
const commands: PlayerCommands = {
  retry: noop, resume: noop, startOver: noop, reveal: noop, close: noop,
  favorite: noop, toggleMember: noop, removeHistory: noop, openRelated: noop,
};
const view = viewOf({ current: null, season: undefined }, { favourites: {}, memberships: {} });
const inspectorActions = { switchingEpisode: false, onEpisode: noop };
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
      ...inspectorActions,
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
          ...inspectorActions,
        }));
        assert.match(html, />Resume<\/button>/);
        assert.match(html, />Start over<\/button>/);
      }
    } finally { useAppStore.setState({ playback: previous.playback }); }
  });

  it("keeps loading, idle and movie actions in one non-wrapping row aligned right", () => {
    const movie = {
      ...view,
      tab: { id: "movie-1", ref: { kind: "title" as const, id: "movie-1" }, kind: "movie" as const, title: "Film" },
    };
    for (const [candidate, loading] of [[view, true], [movie, false]] as const) {
      const html = renderToStaticMarkup(createElement(PlayerInspector, {
        view: candidate, commands, paused: true, loading, sources: [], activeId: "", onSelect: noop,
        ...inspectorActions,
      }));
      assert.doesNotMatch(html, /grid-cols-2|aria-label="Previous episode|aria-label="Next episode/);
      assert.match(html, /aria-label="Player actions"[^>]*flex-nowrap/);
      assert.match(html, /aria-label="Playback position actions"[^>]*ml-auto[^>]*flex-nowrap/);
      assert.doesNotMatch(html, /aria-label="Episode navigation"/);
      assert.match(html, /h-ctl-sm/);
      assert.match(html, /Resume\./);
      assert.match(html, /Start over\./);
    }
  });

  it("places Source in the inspector footer before Resume and Start over", () => {
    const sources = [
      { id: "a", kind: "stream" as const, name: "Source A", url: "https://a.example/video.mp4" },
      { id: "b", kind: "stream" as const, name: "Source B", url: "https://b.example/video.mp4" },
    ];
    const html = renderToStaticMarkup(createElement(PlayerInspector, {
      view, commands, paused: true, loading: false, sources, activeId: "a", onSelect: noop,
      ...inspectorActions,
    }));
    assert.match(html, /aria-label="Source"/);
    assert.ok(html.indexOf('aria-label="Source"') > html.indexOf('role="status"'));
    assert.ok(html.indexOf('aria-label="Source"') < html.indexOf('>Resume</button>'));
  });

  it("draws compact series first, middle and last episode states with accessible reasons", () => {
    const states: EpisodeAdjacency[] = [
      { previous: { reason: "This is the first episode." }, next: { target: { season: 1, episode: 2 } } },
      { previous: { target: { season: 1, episode: 1 } }, next: { target: { season: 1, episode: 3 } } },
      { previous: { target: { season: 1, episode: 2 } }, next: { reason: "This is the last episode." } },
    ];
    const series = {
      ...view,
      tab: { id: "tv-1", ref: { kind: "title" as const, id: "tv-1" }, kind: "tv" as const,
        title: "Series", subtitle: "S01 E02" },
      item: { ref: { kind: "title" as const, id: "tv-1" }, kind: "tv" as const, title: "Series",
        genres: [], favorite: false },
      season: 1,
      episode: 2,
    };
    for (const adjacency of states) {
      const html = renderToStaticMarkup(createElement(PlayerInspector, {
        view: series, commands, paused: true, loading: false, sources: [], activeId: "", onSelect: noop,
        adjacency, ...inspectorActions,
      }));
      assert.match(html, /aria-label="Previous episode/);
      assert.match(html, /aria-label="Next episode/);
      assert.doesNotMatch(html, /grid-cols-2|Rewind|Forward|Loop|Play\/pause|Volume|Captions|Speed|Auto-next/);
    }
    const first = renderToStaticMarkup(createElement(PlayerInspector, {
      view: series, commands, paused: true, loading: false, sources: [], activeId: "", onSelect: noop,
      adjacency: states[0], ...inspectorActions,
    }));
    assert.match(first, /Previous episode\. This is the first episode\./);
    const last = renderToStaticMarkup(createElement(PlayerInspector, {
      view: series, commands, paused: true, loading: false, sources: [], activeId: "", onSelect: noop,
      adjacency: states[2], ...inspectorActions,
    }));
    assert.match(last, /Next episode\. This is the last episode\./);
  });

  it("orders Source, saved point and one left/right series action row without staggering", () => {
    const sources = [
      { id: "a", kind: "stream" as const, name: "A", url: "https://a.example/video.mp4" },
      { id: "b", kind: "stream" as const, name: "B", url: "https://b.example/video.mp4" },
    ];
    const series = {
      ...view,
      tab: { id: "tv-1", ref: { kind: "title" as const, id: "tv-1" }, kind: "tv" as const,
        title: "Series", subtitle: "S01 E02" },
      item: { ref: { kind: "title" as const, id: "tv-1" }, kind: "tv" as const, title: "Series", genres: [],
        favorite: false, progress: { positionMs: 12_000, state: "watching" as const, season: 1, episode: 2 } },
      season: 1,
      episode: 2,
    };
    const adjacency: EpisodeAdjacency = {
      previous: { target: { season: 1, episode: 1 } }, next: { target: { season: 1, episode: 3 } },
    };
    const html = renderToStaticMarkup(createElement(PlayerInspector, {
      view: series, commands, paused: true, loading: false, sources, activeId: "a", activeSource: sources[0],
      onSelect: noop, adjacency, ...inspectorActions,
    }));
    const ordered = ['aria-label="Source"', "resume at", 'aria-label="Player actions"',
      'aria-label="Episode navigation"', 'aria-label="Playback position actions"'];
    assert.deepEqual([...ordered].sort((left, right) => html.indexOf(left) - html.indexOf(right)), ordered);
    assert.match(html, new RegExp('aria-label="Player actions"[^>]*flex-nowrap[^>]*>[\\s\\S]*' +
      'aria-label="Episode navigation"[\\s\\S]*aria-label="Playback position actions"'));
    assert.match(html, /aria-label="Episode navigation"[^>]*flex-none flex-nowrap/);
    assert.match(html, /aria-label="Playback position actions"[^>]*ml-auto[^>]*flex-none flex-nowrap/);
    assert.match(html, /h-ctl-sm/);
  });

  it("disables Resume for an unsupported active embed but leaves Start over available", () => {
    const unsupported = {
      id: "provider:1", kind: "embed" as const, name: "Provider",
      embed: { providerId: 1, name: "Provider", url: "https://provider.example/embed",
        origin: "https://provider.example", order: 1, messageShape: "player-event" as const },
    };
    const movie = {
      ...view,
      tab: { id: "movie-1", ref: { kind: "title" as const, id: "movie-1" }, kind: "movie" as const, title: "Film" },
      item: { ref: { kind: "title" as const, id: "movie-1" }, kind: "movie" as const, title: "Film", genres: [],
        favorite: false, progress: { positionMs: 12_000, state: "watching" as const } },
    };
    const html = renderToStaticMarkup(createElement(PlayerInspector, {
      view: movie, commands, paused: true, loading: false, sources: [unsupported], activeId: unsupported.id,
      activeSource: unsupported, onSelect: noop, ...inspectorActions,
    }));
    assert.match(html, /Resume\. This source does not support resuming at a saved position\./);
    assert.match(html, /disabled=""[^>]*>Resume</);
    assert.doesNotMatch(html, /disabled=""[^>]*>Start over</);
  });
});
