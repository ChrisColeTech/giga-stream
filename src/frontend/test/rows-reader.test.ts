import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_QUERY, type LibraryQuery } from "@/lib/library-query";
import { revealedShelves, shelfCount, type ShelfLoads } from "@/lib/rows-reveal";
import { planShelves, type ShelfSpec } from "@/lib/rows-shelves";
import { RowsReader, appendRows } from "@/services/rows-reader";
import type { LibraryItem, LibraryPage } from "@/types/library";

function row(id: string): LibraryItem {
  return { ref: { kind: "title", id }, kind: "movie", title: id, genres: [], favorite: false };
}

function page(items: readonly LibraryItem[], nextCursor?: string, total?: number): LibraryPage {
  return {
    items, facets: { genres: [], years: [] }, trending: false, titlesAvailable: true,
    ...(nextCursor !== undefined && { nextCursor }), ...(total !== undefined && { total }),
  };
}

interface Call {
  readonly query: LibraryQuery;
  readonly cursor?: string;
  readonly resolve: (answer: LibraryPage) => void;
  readonly reject: (error: unknown) => void;
}

function harness() {
  const calls: Call[] = [];
  const said: string[] = [];
  let loads: ShelfLoads = new Map();
  const reader = new RowsReader((next) => { loads = next; }, {
    read: (query, _signal, cursor) => new Promise<LibraryPage>((resolve, reject) => {
      calls.push({ query, resolve, reject, ...(cursor !== undefined && { cursor }) });
    }),
    remember: () => undefined,
    say: (sentence) => said.push(sentence),
  });
  return { calls, said, reader, loads: () => loads };
}

const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));
const SPECS: readonly ShelfSpec[] = planShelves({
  query: { ...DEFAULT_QUERY, scope: "movie" }, genreFacets: ["Drama", "Mystery"], collections: [], showContinue: false,
});

describe("the Rows reader", () => {
  it("reads every shelf's first page with its own query, and reveals only once all have answered", async () => {
    const { calls, reader, loads } = harness();
    reader.start(SPECS);
    assert.deepEqual(calls.map((call) => call.query), SPECS.map((spec) => spec.query));
    calls[0]?.resolve(page([row("a")], "c1", 300));
    await settle();
    assert.equal(revealedShelves(SPECS, loads()), null);
    calls[1]?.resolve(page([]));
    calls[2]?.resolve(page([row("b")]));
    calls[3]?.resolve(page([row("c")]));
    await settle();
    assert.deepEqual(revealedShelves(SPECS, loads()), SPECS.filter((_, at) => at !== 1).map((spec) => spec.id));
  });

  it("appends a shelf's next page after its cards, without moving them", async () => {
    const { calls, reader, loads } = harness();
    reader.start(SPECS.slice(0, 1));
    calls[0]?.resolve(page([row("a"), row("b")], "c1", 300));
    await settle();
    assert.equal(reader.more(SPECS[0]?.id ?? ""), true);
    assert.equal(reader.more(SPECS[0]?.id ?? ""), false, "one page at a time");
    assert.equal(calls[1]?.cursor, "c1");
    calls[1]?.resolve(page([row("b"), row("c")]));
    await settle();
    const load = loads().get(SPECS[0]?.id ?? "");
    assert.deepEqual(load?.items.map((item) => item.ref.id), ["a", "b", "c"]);
    assert.equal(load?.nextCursor, undefined);
    assert.equal(load === undefined ? 0 : shelfCount(load), 300);
    assert.equal(reader.more(SPECS[0]?.id ?? ""), false, "the true end");
  });

  it("ignores a late answer of an older plan", async () => {
    const { calls, reader, loads } = harness();
    reader.start(SPECS.slice(0, 1));
    reader.start(SPECS.slice(1, 2));
    calls[0]?.resolve(page([row("stale")]));
    await settle();
    assert.equal(loads().has(SPECS[0]?.id ?? ""), false);
    assert.equal(loads().get(SPECS[1]?.id ?? "")?.answered, false);
  });

  it("drops a failed first page, ends a shelf at a failed next page, and says one sentence", async () => {
    const { calls, reader, loads, said } = harness();
    reader.start(SPECS.slice(0, 2));
    calls[0]?.resolve(page([row("a")], "c1"));
    calls[1]?.reject(new Error("Catalog could not be read."));
    await settle();
    assert.deepEqual(revealedShelves(SPECS.slice(0, 2), loads()), [SPECS[0]?.id]);
    reader.more(SPECS[0]?.id ?? "");
    calls[2]?.reject(new Error("Catalog could not be read."));
    await settle();
    assert.equal(loads().get(SPECS[0]?.id ?? "")?.nextCursor, undefined);
    assert.equal(reader.more(SPECS[0]?.id ?? ""), false);
    assert.deepEqual(said, ["Catalog could not be read."]);
  });

  it("deduplicates appended rows by identity", () => {
    assert.deepEqual(appendRows([row("a")], [row("a"), row("b")]).map((item) => item.ref.id), ["a", "b"]);
  });
});
