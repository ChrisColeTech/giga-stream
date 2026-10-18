import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { newer, older, pagingReasons, START_VIEW, type BrowseQuery } from "@/lib/title-query";
import type { TitleList } from "@/services/schemas/title-schema";
import { createTitleFlows } from "@/services/title-flows";
import type { TitlesService } from "@/services/titles";
import { useAppStore } from "@/store/app-store";
import { resetStore, signInForTest } from "./support/store";

const state = () => useAppStore.getState();
const NEVER = async (): Promise<never> => Promise.reject(new Error("not used"));

function rig(totalPages: number) {
  const pages: number[] = [];
  const service: TitlesService = {
    list: async (query?: BrowseQuery): Promise<TitleList> => {
      pages.push(query?.page ?? 0);
      const id = `movie-${query?.page ?? 0}`;
      const items = [{ id, kind: "movie" as const, title: id, state: "synced" as const }];
      return { items, page: query?.page ?? 1, totalPages, totalResults: 20, unreadable: 0 };
    },
    search: NEVER,
    detail: NEVER,
    create: NEVER,
    update: NEVER,
    remove: NEVER,
    revert: NEVER,
    listDeleted: async () => [],
    restore: NEVER,
  };
  const audit = { reload: async () => undefined };
  return { flows: createTitleFlows({ service, store: () => useAppStore.getState(), audit }), pages };
}

beforeEach(() => {
  resetStore();
  signInForTest();
});

describe("paging bounds", () => {
  it("Newer is disabled at page 1 and Older at the last page, with their sentences", () => {
    assert.deepEqual(pagingReasons(1, 3), { newer: "This is the first page." });
    assert.deepEqual(pagingReasons(2, 3), {});
    assert.deepEqual(pagingReasons(3, 3), { older: "This is the last page." });
    assert.deepEqual(pagingReasons(1, 1), { newer: "This is the first page.", older: "This is the last page." });
  });

  it("never steps past either end", () => {
    assert.equal(newer(START_VIEW), START_VIEW);
    const last = { ...START_VIEW, page: 4 };
    assert.equal(older(last, 4), last);
    assert.equal(older(START_VIEW, 4).page, 2);
  });
});

describe("Older and Newer read the next page", () => {
  it("raise and lower the page, each a read of its own", async () => {
    const { flows, pages } = rig(3);
    await flows.load();
    await flows.older();
    await flows.older();
    assert.equal(state().titles.view.page, 3);
    await flows.newer();
    assert.deepEqual(pages, [1, 2, 3, 2]);
    assert.deepEqual(state().titles.items.map((t) => t.id), ["movie-2"]);
  });

  it("a sort change after paging starts again at page 1", async () => {
    const { flows, pages } = rig(5);
    await flows.load();
    await flows.older();
    await flows.sort("az");
    assert.deepEqual([pages, state().titles.view.page, state().titles.view.sort], [[1, 2, 1], 1, "az"]);
  });
});
