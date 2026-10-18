import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  NO_PAGED,
  acceptPage,
  dropPages,
  evict,
  failPage,
  loadedRows,
  patchRow,
  removeRow,
  rowAt,
  startPage,
  type PageAnswer,
} from "@/lib/title-paged";
import { INVENTORY, titleRowOf } from "./support/titles-stored-kit";

const rows = (from: number, count: number) => Array.from({ length: count }, (_, at) => titleRowOf(`movie-${from + at}`));
const answer = (page: number, total = 250, version = "250:1"): PageAnswer => ({
  rows: rows(page * 100, Math.min(100, total - page * 100)),
  total,
  version,
  inventory: INVENTORY,
});

describe("the stored pages", () => {
  it("addresses a row by its index: page = index / 100, place = index % 100", () => {
    const paged = acceptPage(startPage(NO_PAGED, 2), 2, answer(2));
    assert.equal(rowAt(paged, 200)?.id, "movie-200");
    assert.equal(rowAt(paged, 249)?.id, "movie-249");
    assert.equal(rowAt(paged, 99), undefined, "page 0 is not loaded");
    assert.deepEqual([paged.total, paged.loading], [250, []]);
  });

  it("tracks a page in flight once, and clears it on failure", () => {
    const started = startPage(startPage(NO_PAGED, 1), 1);
    assert.deepEqual(started.loading, [1]);
    assert.deepEqual(failPage(started, 1).loading, []);
  });

  it("drops every page held when a page answers with another version, keeping the new one", () => {
    let paged = acceptPage(NO_PAGED, 0, answer(0));
    paged = acceptPage(paged, 1, answer(1));
    assert.equal(loadedRows(paged).length, 200);
    paged = acceptPage(paged, 2, answer(2, 251, "251:9"));
    assert.deepEqual(Object.keys(paged.pages), ["2"]);
    assert.equal(paged.total, 251);
  });

  it("keeps at most MAX_PAGES_KEPT pages, the nearest to the page just read", () => {
    const pages = Object.fromEntries(Array.from({ length: 40 }, (_, page) => [page, rows(page, 1)]));
    const kept = Object.keys(evict(pages, 39)).map(Number);
    assert.equal(kept.length, 30);
    assert.ok(kept.includes(39) && kept.includes(10) && !kept.includes(9) && !kept.includes(0));
  });

  it("patches a row wherever it is loaded, and removes one with the total falling by one", () => {
    const paged = acceptPage(NO_PAGED, 0, answer(0));
    const patched = patchRow(paged, titleRowOf("movie-5", { title: "Renamed" }));
    assert.equal(rowAt(patched, 5)?.title, "Renamed");
    const removed = removeRow(patched, "movie-5");
    assert.deepEqual([removed.total, loadedRows(removed).length, rowAt(removed, 5)?.id], [249, 99, "movie-6"]);
    assert.equal(removeRow(removed, "movie-900").total, 249, "a row that is not loaded changes nothing");
  });

  it("drops the pages but keeps the total, the marker and the counts", () => {
    const dropped = dropPages(acceptPage(NO_PAGED, 0, answer(0)));
    assert.deepEqual([dropped.pages, dropped.total, dropped.version], [{}, 250, "250:1"]);
    assert.deepEqual(dropped.inventory, INVENTORY);
  });
});
