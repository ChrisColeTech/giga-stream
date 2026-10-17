import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { DEFAULT_SETTINGS } from "@/constants/settings-defaults";
import { DEFAULT_QUERY } from "@/lib/library-query";
import { reloadDecision } from "@/lib/library-reload";
import { restoredQuery, savedChange } from "@/lib/library-restore";
import { SettingsSchema, type SettingsAnswer, type SettingsPatch } from "@/services/schemas/settings-schema";
import { libraryQueryKey } from "@/services/library";
import { startSettingsWriteback } from "@/hooks/useSettingsWriteback";
import { useAppStore } from "@/store/app-store";

const state = () => useAppStore.getState();
const prefs = (change: Partial<typeof DEFAULT_SETTINGS> = {}) => ({ ...state().library, ...change });

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});

describe("the settings schema for the saved Library state", () => {
  it("defaults to the unfiltered Library", () => {
    assert.equal(SettingsSchema.safeParse({ ...DEFAULT_SETTINGS, adminUrl: "http://127.0.0.1:8091" }).success, true);
    assert.deepEqual(
      [DEFAULT_SETTINGS.libraryScope, DEFAULT_SETTINGS.librarySource, DEFAULT_SETTINGS.libraryGenres,
        DEFAULT_SETTINGS.libraryYear, DEFAULT_SETTINGS.libraryWatched],
      ["all", "all", [], "", "all"],
    );
  });
  it("refuses an unknown scope, source, year, watched value or genre list", () => {
    for (const bad of [
      { libraryScope: "music" }, { librarySource: "nowhere" }, { libraryYear: "99" }, { libraryYear: "20x4" },
      { libraryWatched: "seen" }, { libraryGenres: [""] }, { libraryGenres: "Drama" },
    ]) {
      const row = { ...DEFAULT_SETTINGS, adminUrl: "http://127.0.0.1:8091", ...bad };
      assert.equal(SettingsSchema.safeParse(row).success, false, JSON.stringify(bad));
    }
  });
});

describe("restoring the saved query", () => {
  it("applies every saved field", () => {
    const query = restoredQuery(
      prefs({
        libraryScope: "tv", librarySource: "collection:c1", libraryGenres: ["Drama"], libraryYear: "1999",
        libraryWatched: "watching", librarySort: "az",
      }),
      ["c1"],
    );
    assert.deepEqual(query, {
      scope: "tv", source: "collection:c1", genres: ["Drama"], year: "1999", watched: "watching", sort: "az",
    });
  });
  it("never carries a search", () => {
    assert.equal("search" in restoredQuery(prefs(), []), false);
  });
  it("falls back to the default for each value that is no longer valid", () => {
    const query = restoredQuery(
      {
        ...prefs(),
        libraryScope: "music" as never, librarySource: "collection:gone", libraryGenres: ["", "  ", "Drama"],
        libraryYear: "abc", libraryWatched: "seen" as never, librarySort: "random" as never,
      },
      ["c1"],
    );
    assert.deepEqual(query, {
      scope: "all", source: "all", genres: ["Drama"], year: "", watched: "all", sort: "newest",
    });
  });
});

describe("what a query change saves", () => {
  it("saves the Type, source, filters and sort, and only what differs", () => {
    assert.deepEqual(
      savedChange({ scope: "movie", source: "history", genres: ["A"], year: "2001", watched: "watched", sort: "year" }, prefs()),
      {
        libraryScope: "movie", librarySource: "history", libraryGenres: ["A"], libraryYear: "2001",
        libraryWatched: "watched", librarySort: "year",
      },
    );
    assert.deepEqual(savedChange({ scope: "all", genres: [], year: "" }, prefs()), {});
  });
  it("does not save the search or the trending sort", () => {
    assert.deepEqual(savedChange({ search: "alien", sort: "trending" }, prefs()), {});
  });
});

describe("hydration and the first read", () => {
  const saved = {
    ...DEFAULT_SETTINGS, libraryView: "list" as const, librarySort: "oldest" as const, libraryScope: "movie" as const,
    libraryGenres: ["Horror"], libraryYear: "1982", libraryWatched: "unwatched" as const,
  };

  it("puts the saved state in the store, so the first read is built from it", () => {
    state().applySnapshot({ settings: saved, unreadable: [] });
    assert.equal(state().library.libraryView, "list");
    const first = { ...DEFAULT_QUERY, ...restoredQuery(state().library, state().collections.map((row) => row.id)) };
    assert.equal(first.scope, "movie");
    assert.notEqual(libraryQueryKey(first), libraryQueryKey(DEFAULT_QUERY));
    assert.deepEqual([first.genres, first.year, first.watched, first.sort], [["Horror"], "1982", "unwatched", "oldest"]);
  });

  it("holds the first read until the saved state is applied, then reads once without a further reload", () => {
    const waiting = reloadDecision({
      initial: true, active: true, queryChanged: true, serialChanged: false, dirty: false, ready: false,
    });
    assert.deepEqual(waiting, { reload: false, dirty: false });
    assert.deepEqual(
      reloadDecision({ initial: true, active: true, queryChanged: false, serialChanged: false, dirty: false, ready: true }),
      { reload: true, dirty: false },
    );
    assert.deepEqual(
      reloadDecision({ initial: false, active: true, queryChanged: false, serialChanged: false, dirty: false, ready: true }),
      { reload: false, dirty: false },
      "showing the Library again keeps its list",
    );
  });
});

describe("saving through the settings write-back", () => {
  it("writes a filter change as its own keys and nothing else", async () => {
    const writes: SettingsPatch[] = [];
    useAppStore.setState({ settingsWriteEnabled: true, hydrationApplied: true, committedSettings: DEFAULT_SETTINGS });
    const stop = startSettingsWriteback({
      getState: useAppStore.getState,
      subscribe: useAppStore.subscribe,
      write: async (patch): Promise<SettingsAnswer> => {
        writes.push(patch);
        return { ...DEFAULT_SETTINGS, ...patch };
      },
    });
    state().setLibraryPrefs(savedChange({ scope: "tv", genres: ["Drama", "War"], sort: "az" }, state().library));
    await Promise.resolve();
    await Promise.resolve();
    assert.deepEqual(writes, [{ libraryScope: "tv", libraryGenres: ["Drama", "War"], librarySort: "az" }]);
    assert.deepEqual(state().library.libraryGenres, ["Drama", "War"]);
    stop();
  });
});
