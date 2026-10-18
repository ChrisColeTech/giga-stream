import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { ApiError } from "@giga/http/api-error";
import { draftOfTitle as draftFrom } from "@/lib/title-draft";
import type { BrowseQuery, SearchQuery } from "@/lib/title-query";
import type { AdminTitleRow, TitleList } from "@/services/schemas/title-schema";
import { createTitleFlows } from "@/services/title-flows";
import type { TitlesService } from "@/services/titles";
import { useAppStore } from "@/store/app-store";
import { resetStore, signInForTest } from "./support/store";

const state = () => useAppStore.getState();
const notice = (): string => state().notice?.sentence ?? "";
const row = (id: string, extra: Partial<AdminTitleRow> = {}): AdminTitleRow => ({
  id,
  kind: id.startsWith("tv") ? "tv" : "movie",
  title: id,
  state: "synced",
  ...extra,
});
const list = (items: AdminTitleRow[], totalPages = 2): TitleList => ({
  items,
  page: 1,
  totalPages,
  totalResults: items.length,
  unreadable: 0,
});
const TMDB_DOWN = new ApiError("tmdb.unavailable", "The title service cannot be reached right now.", 503);

function rig(script: Partial<TitlesService> = {}) {
  const calls: string[] = [];
  const service: TitlesService = {
    list: async (query?: BrowseQuery) => (calls.push(`list:${query?.kind}:${query?.page}`), list([row("movie-1")])),
    search: async (query: SearchQuery) => (calls.push(`search:${query.kind}`), list([row(`${query.kind}-5`)])),
    detail: async (id) => ({ ...row(id), plot: "P", sources: [{ name: "S", url: "https://s.test" }] }),
    create: async (input) => row("custom-1", { state: "manual", title: String(input["title"]) }),
    update: async (id) => row(id, { state: "edited" }),
    remove: async (id) => ({ id }),
    revert: async (id) => row(id),
    ...script,
  };
  const audit = { reload: async () => undefined };
  const flows = createTitleFlows({ service, store: () => useAppStore.getState(), audit });
  return { flows, calls };
}

beforeEach(() => {
  resetStore();
  signInForTest();
});

describe("the list", () => {
  it("with no TMDB token keeps the skeleton and says the backend's sentence; manual titles still create", async () => {
    const { flows } = rig({ list: async () => Promise.reject(TMDB_DOWN) });
    const result = await flows.load();
    assert.deepEqual([result.ok, state().titles.status, state().titles.items.length], [false, "failed", 0]);
    assert.equal(notice(), "The title service cannot be reached right now.");
    assert.equal(state().titles.unreachable, false, "TMDB being down is not the admin backend being down");
    assert.equal((await flows.create({ title: "Mine", kind: "movie", year: "2001" })).ok, true);
    assert.deepEqual(state().titles.items.map((t) => t.title), ["Mine"]);
  });

  it("searches both kinds as two calls and keeps the rows of the one that answered", async () => {
    const { flows, calls } = rig({
      search: async (query) => (query.kind === "tv" ? Promise.reject(TMDB_DOWN) : list([row("movie-5")])),
    });
    flows.type("dune");
    assert.deepEqual(calls, [], "typing reads nothing");
    await flows.search();
    assert.deepEqual(state().titles.items.map((t) => t.id), ["movie-5"]);
    assert.equal(notice(), "The title service cannot be reached right now.");
  });

  it("drops a late answer for a view that is no longer shown", async () => {
    let release: () => void = () => undefined;
    const { flows } = rig({
      list: (query) =>
        query?.sort === "newest"
          ? new Promise((resolve) => (release = () => resolve(list([row("movie-old")]))))
          : Promise.resolve(list([row("movie-az")])),
    });
    const first = flows.load();
    await flows.sort("az");
    release();
    assert.equal((await first).ok, false);
    assert.deepEqual(state().titles.items.map((t) => t.id), ["movie-az"]);
  });

  it("drops an answer from an earlier session (serial)", async () => {
    let release: () => void = () => undefined;
    const { flows } = rig({ list: () => new Promise((resolve) => (release = () => resolve(list([row("movie-x")])))) });
    const pending = flows.load();
    state().signOut();
    release();
    assert.equal((await pending).ok, false);
    assert.deepEqual(state().titles.items, []);
  });
});

describe("the records", () => {
  it("refuses Revert to TMDB for a manual title with the backend's 409", async () => {
    const { flows } = rig({
      revert: async () =>
        Promise.reject(new ApiError("title.manual", "A title made by hand has no TMDB copy to go back to.", 409)),
    });
    assert.equal((await flows.revert("custom-1")).ok, false);
    assert.equal(notice(), "A title made by hand has no TMDB copy to go back to.");
  });

  it("deletes a synced title and closes its open workspace", async () => {
    const { flows } = rig();
    await flows.load();
    state().openWorkspace("titles", "movie-1");
    await flows.remove("movie-1");
    assert.deepEqual([state().titles.items.length, state().workspaces.titles, notice()], [0, null, "Deleted movie-1."]);
  });

  it("reads a detail for the open workspace; a save keeps its sources and sends only changed fields", async () => {
    let sent: unknown = null;
    const { flows } = rig({
      update: async (id, body) => ((sent = body), { ...row(id, { state: "edited" }), plot: "New" }),
    });
    await flows.load();
    await flows.detail("movie-1");
    const detail = state().titles.detail?.value;
    assert.ok(detail !== null && detail !== undefined);
    const saved = await flows.save("movie-1", { ...draftFrom(detail), plot: "New" });
    assert.ok(saved.ok);
    assert.deepEqual(sent, { plot: "New" });
    assert.deepEqual([state().titles.detail?.value?.plot, state().titles.detail?.value?.sources?.length], ["New", 1]);
    assert.equal(state().titles.items[0]?.state, "edited");
  });
});
