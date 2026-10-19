import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_CHANNEL_QUERY,
  isDefaultQuery,
  LIVE_ROWS_PATH,
  pagePath,
  pressHeading,
  queryKey,
  queryOfPlaylist,
  withPlaylist,
  withDirection,
  withFilter,
  withSearch,
  withSortKey,
} from "@/lib/channel-query";

const params = (path: string): Record<string, string> => Object.fromEntries(new URL(path, "http://x").searchParams);

describe("the Channels query builder (the contract of docs/41 section 3.1)", () => {
  it("asks for page N at offset N times the size, always with limit, sort and dir, and no empty filter", () => {
    assert.equal(pagePath(DEFAULT_CHANNEL_QUERY, 0), "/api/admin/channels?limit=100&offset=0&sort=name&dir=asc");
    assert.deepEqual(params(pagePath(DEFAULT_CHANNEL_QUERY, 3)), { limit: "100", offset: "300", sort: "name", dir: "asc" });
    assert.deepEqual(params(pagePath(DEFAULT_CHANNEL_QUERY, 2, 200)), { limit: "200", offset: "400", sort: "name", dir: "asc" });
    assert.equal(pagePath(DEFAULT_CHANNEL_QUERY, -4).includes("offset=0"), true);
  });

  it("carries every set parameter by its backend name", () => {
    const query = { ...DEFAULT_CHANNEL_QUERY, q: "bbc one", kind: "stream", origin: "synced", enabled: "false", playlist: "7", sort: "playlist", dir: "desc" } as const;
    assert.deepEqual(params(pagePath(query, 1)), {
      limit: "100", offset: "100", q: "bbc one", kind: "stream", origin: "synced", enabled: "false",
      playlist: "7", sort: "playlist", dir: "desc",
    });
    assert.equal("source" in params(pagePath(query, 1)), false, "the old source filter is gone");
    assert.deepEqual(params(pagePath({ ...DEFAULT_CHANNEL_QUERY, kind: "live", state: "failed" }, 0)).state, "failed");
  });

  it("encodes a search that holds reserved characters", () => {
    const path = pagePath(withSearch(DEFAULT_CHANNEL_QUERY, "  a&b=c #1 "), 0);
    assert.equal(params(path)["q"], "a&b=c #1");
  });

  it("reads the live rows with one fixed request: kind live at the backend's largest page", () => {
    assert.deepEqual(params(LIVE_ROWS_PATH), { limit: "200", offset: "0", kind: "live", sort: "name", dir: "asc" });
  });

  it("a filter that implies another clears the one that contradicts it", () => {
    const stream = withFilter(DEFAULT_CHANNEL_QUERY, "origin", "edited");
    assert.deepEqual([stream.kind, stream.origin], ["stream", "edited"]);
    const live = withFilter(stream, "state", "live");
    assert.deepEqual([live.kind, live.origin, live.state], ["live", "all", "live"]);
    assert.deepEqual([withFilter(live, "kind", "stream").state, withFilter(stream, "kind", "live").origin], ["all", "all"]);
    assert.deepEqual([withFilter(live, "state", "all").kind, withFilter(stream, "enabled", "true").origin], ["live", "edited"]);
  });

  it("a heading press sorts ascending, then descending; a new column starts ascending; a non-sortable one changes nothing", () => {
    const name = pressHeading(DEFAULT_CHANNEL_QUERY, "name");
    assert.deepEqual([name.sort, name.dir], ["name", "desc"]);
    assert.equal(pressHeading(name, "name").dir, "asc");
    const category = pressHeading(name, "category");
    assert.deepEqual([category.sort, category.dir], ["category", "asc"]);
    assert.equal(pressHeading(category, "now-playing"), category);
  });

  it("the Sort select changes the column and keeps the direction; the arrow changes the direction", () => {
    const desc = withDirection(DEFAULT_CHANNEL_QUERY, "desc");
    assert.deepEqual([withSortKey(desc, "kind").sort, withSortKey(desc, "kind").dir], ["kind", "desc"]);
  });

  it("serialises to a key that changes with every part, and the default is recognised", () => {
    assert.equal(isDefaultQuery(DEFAULT_CHANNEL_QUERY), true);
    const keys = new Set([
      queryKey(DEFAULT_CHANNEL_QUERY),
      queryKey(withSearch(DEFAULT_CHANNEL_QUERY, "x")),
      queryKey(withFilter(DEFAULT_CHANNEL_QUERY, "kind", "live")),
      queryKey(withFilter(DEFAULT_CHANNEL_QUERY, "enabled", "true")),
      queryKey(withDirection(DEFAULT_CHANNEL_QUERY, "desc")),
      queryKey(withPlaylist(DEFAULT_CHANNEL_QUERY, "3")),
    ]);
    assert.equal(keys.size, 6);
    assert.equal(isDefaultQuery(withSearch(DEFAULT_CHANNEL_QUERY, "x")), false);
  });

  it("the Playlist select narrows to one playlist's stream rows and goes back to all; Channels → starts from the default", () => {
    const live = withFilter(DEFAULT_CHANNEL_QUERY, "state", "failed");
    const narrowed = withPlaylist(live, "4");
    assert.deepEqual([narrowed.playlist, narrowed.kind, narrowed.state], ["4", "all", "all"]);
    assert.equal(withPlaylist(narrowed, "").playlist, "");
    assert.equal(withFilter(narrowed, "kind", "live").playlist, "", "a live kind has no playlist");
    assert.equal(withFilter(narrowed, "state", "live").playlist, "");
    const opened = queryOfPlaylist(12);
    assert.deepEqual(opened, { ...DEFAULT_CHANNEL_QUERY, playlist: "12" });
    assert.equal(params(pagePath(opened, 0))["playlist"], "12");
  });
});
