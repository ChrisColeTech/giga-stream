import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { categoryOptions, filterChannels, keyTarget, openingChannel, tabStopId } from "@/lib/live-channels";
import { ALL_CATEGORY } from "@/lib/live-constants";
import type { Channel } from "@/types/channel";

const items: readonly Channel[] = [
  { id: "news", name: "Fixture News", category: "News", number: "1", revision: 1, streamUrl: "https://stream.test/news.m3u8", status: "live" },
  { id: "sports", name: "Court Side", category: "Sports", number: "2", revision: 1, streamUrl: "https://stream.test/sports.m3u8", status: "offline" },
  { id: "desk", name: "Night Desk", category: "News", number: "3", revision: 1, streamUrl: "https://stream.test/desk.m3u8", status: "unknown" },
];
const categories = [{ value: "News", count: 2 }, { value: "Sports", count: 1 }];
const names = (rows: readonly Channel[]) => rows.map((row) => row.name);

describe("filterChannels", () => {
  it("keeps every channel in published order when the query is blank and the category is All", () => {
    assert.deepEqual(filterChannels(items, "", ALL_CATEGORY), items);
    assert.deepEqual(filterChannels(items, "   ", ALL_CATEGORY), items);
  });

  it("matches the name case-insensitively and ignores surrounding spaces", () => {
    assert.deepEqual(names(filterChannels(items, "  NEWS ", ALL_CATEGORY)), ["Fixture News"]);
  });

  it("narrows to one category, keeping the order", () => {
    const rows = filterChannels(items, "", "Kids");
    assert.ok(rows.length > 0);
    assert.ok(rows.every((row) => row.category === "Kids"));
    assert.deepEqual(rows.map((row) => row.id), items.filter((row) => row.category === "Kids").map((row) => row.id));
  });

  it("combines the query and the category", () => {
    assert.deepEqual(names(filterChannels(items, "news", "Sports")), []);
    assert.deepEqual(names(filterChannels(items, "desk", "News")), ["Night Desk"]);
  });
});

describe("categoryOptions", () => {
  it("puts All first with the total, then each published category with its count", () => {
    const options = categoryOptions(categories, ALL_CATEGORY, items.length);
    assert.equal(options[0]?.value, ALL_CATEGORY);
    assert.equal(options[0]?.count, items.length);
    assert.deepEqual(
      options.slice(1).map((option) => [option.value, option.count]),
      categories.map((category) => [category.value, category.count]),
    );
  });

  it("keeps a selected category that is no longer published, at zero", () => {
    const options = categoryOptions(categories, "Retired", items.length);
    assert.deepEqual(options.at(-1), { value: "Retired", label: "Retired", count: 0 });
  });
});

describe("openingChannel", () => {
  const list = { items, categories, revision: 1 };

  it("selects and attaches a hydrated last channel only in last mode", () => {
    assert.equal(openingChannel(list, "sports", "last").selected?.id, "sports");
    assert.equal(openingChannel(list, "sports", "last").playing?.id, "sports");
  });

  it("selects the first row but attaches nothing in none mode", () => {
    assert.equal(openingChannel(list, "sports", "none").selected?.id, "news");
    assert.equal(openingChannel(list, "sports", "none").playing, null);
  });

  it("does not attach a last channel no longer in the hydrated list", () => {
    assert.equal(openingChannel(list, "missing", "last").selected?.id, "news");
    assert.equal(openingChannel(list, "missing", "last").playing, null);
  });
});

describe("tabStopId", () => {
  it("is the selected row when it is listed", () => {
    assert.equal(tabStopId(["a", "b", "c"], "b"), "b");
  });

  it("falls back to the first listed row when the selection is filtered out or absent", () => {
    assert.equal(tabStopId(["a", "b"], "z"), "a");
    assert.equal(tabStopId(["a", "b"], null), "a");
  });

  it("is null when nothing is listed", () => {
    assert.equal(tabStopId([], "a"), null);
  });
});

describe("keyTarget", () => {
  const ids = ["a", "b", "c"];

  it("moves one row with Down and Up", () => {
    assert.equal(keyTarget(ids, "a", "ArrowDown"), "b");
    assert.equal(keyTarget(ids, "b", "ArrowUp"), "a");
  });

  it("stays on the end row when moving past either end", () => {
    assert.equal(keyTarget(ids, "c", "ArrowDown"), "c");
    assert.equal(keyTarget(ids, "a", "ArrowUp"), "a");
  });

  it("jumps to the first and last rows with Home and End", () => {
    assert.equal(keyTarget(ids, "b", "Home"), "a");
    assert.equal(keyTarget(ids, "b", "End"), "c");
  });

  it("starts from the first row when the selection is not listed", () => {
    assert.equal(keyTarget(ids, null, "ArrowDown"), "a");
    assert.equal(keyTarget(ids, "z", "ArrowDown"), "a");
  });

  it("returns null for other keys and for an empty list, so the caller leaves them alone", () => {
    assert.equal(keyTarget(ids, "a", "Enter"), null);
    assert.equal(keyTarget(ids, "a", "a"), null);
    assert.equal(keyTarget([], null, "ArrowDown"), null);
  });
});
