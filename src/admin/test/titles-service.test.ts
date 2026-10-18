import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { titleCreateBody } from "@/lib/title-body";
import { titles } from "@/services/titles";
import { json, success } from "./support/fake-backend";
import { withBackend } from "./support/global-fetch";
import { resetStore, signInForTest } from "./support/store";

const row = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  kind: "movie",
  title: id,
  state: "synced",
  ...extra,
});
const SENTENCE_503 = "The title service cannot be reached right now.";
const listAnswer = (items: unknown[]) => ({ items, page: 2, totalPages: 7, totalResults: 140 });
const query = (url: string | undefined): URLSearchParams => new URLSearchParams((url ?? "").split("?")[1] ?? "");

beforeEach(() => {
  resetStore();
  signInForTest();
});

describe("the titles service reads", () => {
  it("browses with kind, sort, page and includeDisabled, with the bearer; an unreadable row is counted", async () => {
    await withBackend(
      () => success(listAnswer([row("movie-1"), { id: 5 }, row("custom-x", { state: "manual", enabled: false })])),
      async (calls) => {
        const list = await titles.list({ kind: "all", sort: "az", page: 2 });
        assert.ok(calls[0]?.url.startsWith("/api/titles?"));
        const params = query(calls[0]?.url);
        assert.deepEqual(
          [params.get("kind"), params.get("sort"), params.get("page"), params.get("includeDisabled")],
          ["all", "az", "2", "true"],
        );
        assert.equal(calls[0]?.headers["authorization"], "Bearer a");
        const read = [list.items.map((i) => i.id), list.unreadable, list.totalPages];
        assert.deepEqual(read, [["movie-1", "custom-x"], 1, 7]);
      },
    );
  });

  it("searches one kind with q, page and includeDisabled", async () => {
    await withBackend(
      () => success(listAnswer([row("tv-9", { kind: "tv" })])),
      async (calls) => {
        await titles.search({ q: "the matrix", kind: "tv", page: 1 });
        assert.ok(calls[0]?.url.startsWith("/api/titles/search?"));
        const params = query(calls[0]?.url);
        const read = [params.get("q"), params.get("kind"), params.get("includeDisabled")];
        assert.deepEqual(read, ["the matrix", "tv", "true"]);
      },
    );
  });

  it("reads a detail with includeDisabled, its sources and seasons", async () => {
    await withBackend(
      () =>
        success({
          ...row("tv-3", { kind: "tv" }),
          plot: "P",
          seasons: [{ season: 1, episodeCount: 8 }],
          sources: [{ name: "S", url: "https://s" }],
        }),
      async (calls) => {
        const detail = await titles.detail("tv-3");
        assert.equal(calls[0]?.url, "/api/titles/tv-3?includeDisabled=true");
        assert.deepEqual([detail.plot, detail.seasons?.[0]?.episodeCount, detail.sources?.length], ["P", 8, 1]);
      },
    );
  });

  it("refuses with 503 tmdb.unavailable and its sentence", async () => {
    await withBackend(
      () => json({ ok: false, error: { code: "tmdb.unavailable", message: SENTENCE_503 } }, 503),
      async () => {
        await assert.rejects(titles.list(), { code: "tmdb.unavailable", status: 503 });
      },
    );
  });
});

describe("the titles service writes", () => {
  it("posts a manual title", async () => {
    await withBackend(
      () => success(row("custom-1", { state: "manual" }), 201),
      async (calls) => {
        await titles.create(titleCreateBody({ title: " New ", kind: "tv", year: "2020" }));
        const sent = [calls[0]?.method, calls[0]?.url, calls[0]?.body];
        assert.deepEqual(sent, ["POST", "/api/titles", { kind: "tv", title: "New", year: 2020 }]);
      },
    );
  });

  it("patches with null clearing a field, deletes and reverts by id", async () => {
    await withBackend(
      (call) => success(call.method === "DELETE" ? { id: "movie-1" } : row("movie-1", { state: "edited" })),
      async (calls) => {
        await titles.update("movie-1", { plot: null, enabled: false });
        await titles.remove("movie-1");
        await titles.revert("movie-1");
        const sent = [calls[0]?.method, calls[0]?.url, calls[0]?.body];
        assert.deepEqual(sent, ["PATCH", "/api/titles/movie-1", { plot: null, enabled: false }]);
        assert.deepEqual([calls[1]?.method, calls[1]?.url], ["DELETE", "/api/titles/movie-1"]);
        assert.deepEqual([calls[2]?.method, calls[2]?.url], ["POST", "/api/titles/movie-1/revert"]);
      },
    );
  });

  it("carries 409 title.manual from a revert", async () => {
    await withBackend(
      () => json({ ok: false, error: { code: "title.manual", message: "Manual." } }, 409),
      async () => {
        await assert.rejects(titles.revert("custom-1"), { code: "title.manual", status: 409 });
      },
    );
  });
});
