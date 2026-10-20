import test from "node:test";
import assert from "node:assert/strict";

import { pageOf } from "../src/page";

const rows = Array.from({ length: 45 }, (_, n) => n);

test("a page answers its slice in the order given and the whole total", () => {
  // History pages client-side at the server's page size (docs/61 section 2.5): the rows of the
  // page, newest first as given, and `total` counts the whole list whatever page was asked.
  const first = pageOf(rows, 0, 20);
  assert.deepEqual(first.items, Array.from({ length: 20 }, (_, n) => n));
  assert.equal(first.total, 45);
  const middle = pageOf(rows, 1, 20);
  assert.deepEqual(middle.items, Array.from({ length: 20 }, (_, n) => 20 + n));
  assert.equal(middle.total, 45);
  const last = pageOf(rows, 2, 20);
  assert.deepEqual(last.items, [40, 41, 42, 43, 44]);
  assert.equal(last.total, 45);
});

test("a page past the end answers no rows and the total still reports the whole list", () => {
  const page = pageOf(rows, 3, 20);
  assert.deepEqual(page.items, []);
  assert.equal(page.total, 45);
});

test("a negative page is read as the first and a size below one holds no row", () => {
  assert.deepEqual(pageOf(rows, -1, 20).items, pageOf(rows, 0, 20).items);
  assert.deepEqual(pageOf(rows, 0, 0).items, []);
  assert.deepEqual(pageOf(rows, 0, -20).items, []);
  assert.equal(pageOf(rows, 0, 0).total, 45);
});

test("the slice is not limited to watch entries", () => {
  // The library joins the page's entries to card facts afterwards; the slice itself is generic.
  assert.deepEqual(pageOf(["a", "b", "c"], 0, 2), { items: ["a", "b"], total: 3 });
});
