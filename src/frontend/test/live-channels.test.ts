import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { categoryOptions, keyTarget, openingChannel, tabStopId } from "@/lib/live-channels";
import type { Channel } from "@/types/channel";

const items: readonly Channel[] = [
  { id: "news", name: "Fixture News", category: "News", number: "1", revision: 1, streamUrl: "https://stream.test/news.m3u8" },
  { id: "sports", name: "Court Side", category: "Sports", number: "2", revision: 1, streamUrl: "https://stream.test/sports.m3u8" },
  { id: "desk", name: "Night Desk", category: "News", number: "3", revision: 1, streamUrl: "https://stream.test/desk.m3u8" },
];
const categories = [{ value: "News", count: 2 }, { value: "Sports", count: 1 }];
describe("categoryOptions", () => {
  it("puts All first with the total, then each published category with its count", () => {
    const options = categoryOptions(categories, "all", items.length);
    assert.equal(options[0]?.value, "all");
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
