// `GET /api/admin/channels` paging, search, filters and sort (docs/41 sections 3.1 and 3.4): 250 stream rows seeded in
// the store and 3 live rows made through the API (two playing, one failed).
import assert from "node:assert/strict";
import test from "node:test";

import type { StreamRecord } from "../src/types/channel.js";
import { VIDEOS, liveBody } from "./live-channel-kit.js";
import { pageOf, seedStreams, seededDataDir, streamRows } from "./paging-kit.js";
import { makeApp, pick, send, signIn, type TestApp } from "./test-app.js";

interface Model { id: string; name: string; number: string | null; tvgId: string | null; source: string | null;
  playlist: number | null; playlistName: string | null;
  kind: "live" | "stream"; enabled: boolean; edited: boolean; category: string }

const streams = streamRows();
const LIVE = [
  liveBody({ id: "home", name: "Home Videos", number: 900 }),
  liveBody({ id: "fold", name: "Folder Live", number: 901, videos: undefined, folder: VIDEOS.folder }),
  liveBody({ id: "bad", name: "Broken Live", number: 902, videos: [VIDEOS.broken] }),
];
const model: Model[] = [
  ...streams.map((s: StreamRecord): Model => ({ id: s.id, name: s.name, number: s.number, tvgId: s.tvgId, source: s.source,
    playlist: s.playlistId, playlistName: s.playlistName,
    kind: "stream", enabled: s.enabled, edited: s.editedFields.length > 0, category: s.category })),
  ...LIVE.map((l): Model => ({ id: String(l.id), name: String(l.name), number: String(l.number), tvgId: null, source: null,
    playlist: null, playlistName: null,
    kind: "live", enabled: true, edited: false, category: "Entertainment" })),
];

let shared: { t: TestApp; token: string } | undefined;
async function setup(): Promise<{ t: TestApp; token: string }> {
  if (shared) return shared;
  const dataDir = await seededDataDir(seedStreams);
  const t = await makeApp({ dataDir });
  const token = (await signIn(t.app)).access;
  for (const body of LIVE) assert.equal((await send(t.app, "POST", "/api/admin/channels", body, token)).status, 201);
  await t.live.settled();
  shared = { t, token };
  return shared;
}

const read = async (query: string) => {
  const { t, token } = await setup();
  return send(t.app, "GET", `/api/admin/channels${query}`, undefined, token);
};

/** Every row of a query, walked page by page (200 a page). */
async function walk(query: string): Promise<Array<Record<string, unknown>>> {
  const out: Array<Record<string, unknown>> = [];
  for (let offset = 0; ; offset += 200) {
    const page = pageOf((await read(`?limit=200&offset=${offset}${query}`)).body);
    out.push(...page.items);
    if (page.items.length < 200) return out;
  }
}
const idsOf = (rows: Array<Record<string, unknown>>) => rows.map((row) => String(row.id));
const expect = (keep: (m: Model) => boolean) => model.filter(keep).map((m) => m.id).sort();

test("limit pages the list: 100 rows, the true total, every id exactly once in the old order", async () => {
  const whole = await read("");
  assert.deepEqual(Object.keys(pick(whole.body, "data") as object).sort(), ["items", "revision"]);
  const all = idsOf(pageOf(whole.body).items);
  assert.equal(all.length, 253);
  const pages = await Promise.all([0, 100, 200].map(async (offset) => pageOf((await read(`?limit=100&offset=${offset}`)).body)));
  assert.deepEqual(pages.map((p) => [p.items.length, p.total, p.data.offset, p.data.limit]),
    [[100, 253, 0, 100], [100, 253, 100, 100], [53, 253, 200, 100]]);
  assert.deepEqual(pages.flatMap((p) => idsOf(p.items)), all);
  assert.equal(pages[0]?.data.revision, pick(whole.body, "data.revision"));
  const again = pageOf((await read("?limit=100&offset=100")).body);
  assert.deepEqual(again.items, pages[1]?.items);
  const past = pageOf((await read("?limit=100&offset=1000")).body);
  assert.deepEqual([past.items.length, past.total], [0, 253]);
});

test("each filter alone and combined keeps exactly the matching rows; total counts them", async () => {
  const cases: Array<[string, (m: Model) => boolean]> = [
    ["&q=channel%2012", (m) => m.name.toLowerCase().includes("channel 12")],
    ["&q=137", (m) => m.name.includes("137") || m.number === "137"],
    ["&q=tvg.42", (m) => m.tvgId === "tvg.42"],
    ["&q=B.EXAM", (m) => m.source === "b.example"],
    ["&q=beta", (m) => m.playlistName === "Beta list"],
    ["&q=%25", (m) => m.name.includes("%")],
    ["&q=_", () => false],
    ["&kind=live", (m) => m.kind === "live"],
    ["&kind=stream", (m) => m.kind === "stream"],
    ["&origin=synced", (m) => m.kind === "stream" && m.source !== null && !m.edited],
    ["&origin=edited", (m) => m.kind === "stream" && m.source !== null && m.edited],
    ["&origin=manual", (m) => m.kind === "stream" && m.source === null],
    ["&origin=manual&kind=live", () => false],
    ["&enabled=false", (m) => !m.enabled],
    ["&enabled=true", (m) => m.enabled],
    ["&state=live", (m) => m.id === "home" || m.id === "fold"],
    ["&state=failed", (m) => m.id === "bad"],
    ["&state=stopped", () => false],
    ["&playlist=1", (m) => m.playlist === 1],
    ["&playlist=2&enabled=false&q=channel%201", (m) => m.playlist === 2 && !m.enabled && m.name.includes("Channel 1")],
    ["&playlist=99", () => false],
    ["&status=unchecked", (m) => m.kind === "stream"],
    ["&status=online", () => false],
    ["&status=offline&playlist=1", () => false],
    ["&q=%20%20", () => true],
  ];
  for (const [query, keep] of cases) {
    const rows = await walk(query);
    assert.deepEqual(idsOf(rows).sort(), expect(keep), query);
    assert.equal(pageOf((await read(`?limit=1${query}`)).body).total, rows.length, query);
  }
});

test("number sorts numerically with numberless rows last in both directions; desc reverses the numbered rows", async () => {
  const asc = await walk("&sort=number");
  assert.deepEqual(asc.slice(0, 3).map((row) => row.number), ["1", "2", "3"]);
  const at = (rows: Array<Record<string, unknown>>, n: string) => rows.findIndex((row) => row.number === n);
  // Every tenth row has no number, so the numbers ending in 0 are missing: "12" is the case text order gets wrong.
  assert.ok(at(asc, "2") >= 0 && at(asc, "2") < at(asc, "12"));
  assert.equal(asc.slice(-25).every((row) => row.number === undefined), true);
  const desc = await walk("&sort=number&dir=desc");
  assert.deepEqual(desc.slice(0, 2).map((row) => row.number), ["902", "901"]);
  assert.equal(desc.slice(-25).every((row) => row.number === undefined), true);
  assert.deepEqual(idsOf(desc.slice(0, 228)), idsOf(asc.slice(0, 228)).reverse());
});

test("every sort holds both ways across pages, ties by name then id, each row once", async () => {
  const keyOf: Record<string, (row: Record<string, unknown>) => string> = {
    name: (row) => String(row.name).toLowerCase(),
    category: (row) => String(row.category).toLowerCase(),
    kind: (row) => String(row.kind),
    playlist: (row) => (row.playlistName === undefined ? "￿" : String(row.playlistName).toLowerCase()),
  };
  for (const [sort, key] of Object.entries(keyOf)) {
    for (const dir of ["asc", "desc"] as const) {
      const pages = await Promise.all([0, 100, 200].map(async (o) => pageOf((await read(`?limit=100&offset=${o}&sort=${sort}&dir=${dir}`)).body)));
      const rows = pages.flatMap((p) => p.items);
      assert.equal(new Set(idsOf(rows)).size, 253, `${sort} ${dir}`);
      for (let i = 1; i < rows.length; i++) {
        const [a, b] = [rows[i - 1], rows[i]].map((row) => (row ? key(row) : ""));
        const nulls = sort === "playlist" && (a === "￿" || b === "￿");
        const ordered = nulls ? !(a === "￿" && b !== "￿") : dir === "asc" ? (a ?? "") <= (b ?? "") : (a ?? "") >= (b ?? "");
        assert.ok(ordered, `${sort} ${dir} at ${i}: ${a} then ${b}`);
      }
    }
  }
});

test("invalid values are 400 request.invalid naming the field; a filter without limit is refused", async () => {
  const cases: Array<[string, string]> = [
    ["?limit=0", "limit"], ["?limit=201", "limit"], ["?limit=x", "limit"], ["?limit=10&offset=-1", "offset"],
    ["?limit=10&kind=radio", "kind"], ["?limit=10&origin=x", "origin"], ["?limit=10&enabled=yes", "enabled"],
    ["?limit=10&state=dead", "state"], ["?limit=10&status=maybe", "status"], ["?limit=10&playlist=x", "playlist"],
    ["?limit=10&status=live", "status"], ["?limit=10&status=dead", "status"],
    ["?limit=10&sort=source", "sort"], ["?limit=10&sort=id", "sort"], ["?limit=10&dir=up", "dir"],
    [`?limit=10&q=${"x".repeat(121)}`, "q"], ["?kind=live", "limit"], ["?offset=5", "limit"], ["?sort=name", "limit"],
  ];
  for (const [query, field] of cases) {
    const answer = await read(query);
    assert.deepEqual([answer.status, pick(answer.body, "error.code"), pick(answer.body, "error.details.field")],
      [400, "request.invalid", field], query);
  }
});

test("only the returned rows are decorated with the engine's state", async () => {
  const { t } = await setup();
  const status = t.live.status;
  let calls = 0;
  t.live.status = (id) => {
    calls += 1;
    return status(id);
  };
  try {
    await read("?limit=100");
    assert.equal(calls, 0);
    const one = pageOf((await read("?limit=1&kind=live")).body);
    assert.deepEqual([calls, one.total, one.items[0]?.id, one.items[0]?.state], [1, 3, "home", "live"]);
  } finally {
    t.live.status = status;
  }
});

test("a write changes the revision a page carries; the route is signed-in and no-store", async () => {
  const { t, token } = await setup();
  const before = pageOf((await read("?limit=5")).body).data.revision;
  assert.equal((await send(t.app, "PATCH", "/api/admin/channels/ch_001", { name: "Renamed" }, token)).status, 200);
  const after = pageOf((await read("?limit=5")).body).data.revision;
  assert.notEqual(after, before);
  const anonymous = await send(t.app, "GET", "/api/admin/channels?limit=5");
  assert.deepEqual([anonymous.status, anonymous.headers["cache-control"]], [401, "no-store"]);
  assert.equal((await read("?limit=5")).headers["cache-control"], "no-store");
});
