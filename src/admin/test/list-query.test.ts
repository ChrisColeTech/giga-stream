import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ListQueryBar } from "@/components/records/ListQueryBar";
import { LIST_BARS, LIST_STARTS, type ListId } from "@/constants/list-query-copy";
import type { AccountRowView } from "@/lib/account-rows";
import {
  ANY,
  pressHeading,
  startQuery,
  tickState,
  visibleRows,
  withDirection,
  withFilter,
  withSearch,
  withSortKey,
  withTyped,
} from "@/lib/list-query";
import { accountSpec, deletedSpec, playlistSpec, providerSpec } from "@/lib/list-specs";
import type { PlaylistRowView } from "@/lib/playlist-rows";
import type { ProviderRowView } from "@/lib/provider-rows";
import { enabledState } from "@/lib/row-state";
import { deletedRow } from "@/lib/title-restore";
import { useAppStore } from "@/store/app-store";
import { resetStore } from "./support/store";

const provider = (id: number, name: string, family = "Stream", enabled = true): ProviderRowView => ({
  id,
  order: String(id),
  name,
  source: `${name.toLowerCase()}.example`,
  family,
  state: enabledState(enabled),
});
const rows = [provider(1, "Alpha"), provider(2, "Bravo", "Stream", false), provider(3, "Charlie", "Embed")];
const names = (list: readonly { name: string }[]): string[] => list.map((row) => row.name);
const start = startQuery({ key: "order", dir: "asc" });

beforeEach(() => resetStore());

describe("a held list's query", () => {
  it("searches as every word of the query appearing anywhere in the row, case-insensitively", () => {
    const query = withSearch(withTyped(start, "  EXAMPLE  bra "));
    assert.deepEqual(names(visibleRows(rows, query, providerSpec)), ["Bravo"]);
    assert.deepEqual(names(visibleRows(rows, withSearch(withTyped(start, "zzz")), providerSpec)), []);
  });

  it("runs the typed text only once committed: typing alone filters nothing", () => {
    const typing = withTyped(start, "alpha");
    assert.equal(visibleRows(rows, typing, providerSpec).length, 3);
    assert.equal(withSearch(typing).q, "alpha");
  });

  it("filters by a value and lets the default through", () => {
    const disabled = withFilter(start, "state", "disabled");
    assert.deepEqual(names(visibleRows(rows, disabled, providerSpec)), ["Bravo"]);
    assert.equal(visibleRows(rows, withFilter(disabled, "state", ANY), providerSpec).length, 3);
    const both = withFilter(withFilter(start, "state", "enabled"), "family", "Embed");
    assert.deepEqual(names(visibleRows(rows, both, providerSpec)), ["Charlie"]);
  });

  it("sorts by the chosen column and direction; a heading press goes ascending, then descending", () => {
    const byName = withDirection(withSortKey(start, "name"), "desc");
    assert.deepEqual(names(visibleRows(rows, byName, providerSpec)), ["Charlie", "Bravo", "Alpha"]);
    const pressed = pressHeading(pressHeading(start, "name"), "name");
    assert.deepEqual([pressed.sort.key, pressed.sort.dir], ["name", "desc"]);
    assert.deepEqual(names(visibleRows(rows, pressed, providerSpec)), ["Charlie", "Bravo", "Alpha"]);
  });

  it("leaves Deleted titles in the backend's order, and searches and filters them by kind", () => {
    const items = ["B", "A"].map((title, at) =>
      deletedRow({ id: `movie-${at}`, kind: "movie", tmdbId: at, title, deletedAt: at }),
    );
    const query = startQuery(LIST_STARTS.deleted);
    assert.deepEqual(names(visibleRows(items, query, deletedSpec)), ["B", "A"]);
    assert.deepEqual(names(visibleRows(items, withFilter(query, "kind", "Series"), deletedSpec)), []);
    assert.deepEqual(names(visibleRows(items, withSearch(withTyped(query, "a")), deletedSpec)), ["A"]);
  });

  it("sorts counts by value, not text, and filters playlists by whether they ever ran", () => {
    const playlist = (id: number, channels: string, lastRun: string): PlaylistRowView => ({
      id,
      name: `P${id}`,
      source: "h",
      channels,
      enabled: "0",
      live: "0",
      dead: "0",
      lastRun,
      state: enabledState(true),
      deleteQuestion: "?",
    });
    const list = [playlist(1, "9", "2026-10-01 10:00"), playlist(2, "1,200", "never")];
    const byChannels = withDirection(withSortKey(startQuery({ key: "name", dir: "asc" }), "channels"), "desc");
    assert.deepEqual(names(visibleRows(list, byChannels, playlistSpec)), ["P2", "P1"]);
    assert.deepEqual(names(visibleRows(list, withFilter(start, "last-run", "never"), playlistSpec)), ["P2"]);
    assert.deepEqual(names(visibleRows(list, withFilter(start, "last-run", "ran"), playlistSpec)), ["P1"]);
  });

  it("filters accounts by whether they ever signed in", () => {
    const account = (id: number, when: string): AccountRowView => ({
      id,
      username: `u${id}`,
      state: enabledState(true),
      when,
    });
    const list = [account(1, "2026-10-01 10:00"), account(2, "never")];
    const never = withFilter(start, "sign-in", "never");
    assert.deepEqual(visibleRows(list, never, accountSpec).map((row) => row.username), ["u2"]);
  });

  it("states the header All over the rows shown: ticked, mixed, or none", () => {
    const states = [tickState(["1", "2"], ["1", "2"]), tickState(["1", "2"], ["2"]), tickState(["1"], ["9"])];
    assert.deepEqual(states, [true, "mixed", false]);
    assert.equal(tickState([], []), false);
  });
});

describe("the shared query row", () => {
  it("draws the search, Sort with its direction and each filter select, for every held list", () => {
    const noop = (): void => undefined;
    const handlers = { type: noop, search: noop, filter: noop, sortKey: noop, direction: noop };
    const lists: ListId[] = ["providers", "playlists", "jobs", "accounts", "deleted"];
    for (const list of lists) {
      const def = LIST_BARS[list];
      const query = useAppStore.getState().listQueries[list];
      const html = renderToStaticMarkup(ListQueryBar({ def, query, handlers }));
      assert.ok(html.includes(`aria-label="${def.search}"`) && html.includes("data-search"), list);
      for (const filter of def.filters) {
        assert.ok(html.includes(`aria-label="${filter.label}"`), `${list} ${filter.label}`);
      }
      assert.equal(html.includes('aria-label="Sort"'), def.sorts.length > 0, `${list} sort`);
    }
  });

  it("keeps each list's query in the one store, apart from the others", () => {
    const jobs = useAppStore.getState().listQueries.jobs;
    useAppStore.getState().listQuerySet("jobs", withFilter(jobs, "state", "failed"));
    assert.equal(useAppStore.getState().listQueries.jobs.filters["state"], "failed");
    assert.deepEqual(useAppStore.getState().listQueries.providers.filters, {});
  });
});
