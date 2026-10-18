// The planner (docs/43 section 3.6): three passes over ONE playlist's rows. Pure, so it is tested directly.
import assert from "node:assert/strict";
import test from "node:test";

import type { M3uEntry } from "../src/services/m3u-parser.js";
import { planEntries } from "../src/services/playlist-sync-plan.js";
import { NOT_SYNCED, type StreamRecord } from "../src/types/channel.js";

let counter = 0;
const row = (name: string, url: string, over: Partial<StreamRecord> = {}): StreamRecord => ({
  ...NOT_SYNCED, kind: "stream", id: `row-${(counter += 1)}`, name, category: "News", number: null, logoUrl: null, tvgId: null,
  streamUrl: url, syncName: name, playlistId: 1, editedFields: [], revision: 1, enabled: true, published: true, ...over,
});
const item = (name: string, url: string, over: Partial<M3uEntry> = {}): M3uEntry => ({ name, streamUrl: url, groupTitle: "News", ...over });
const plan = (rows: StreamRecord[], entries: M3uEntry[]) => planEntries({ rows, entries, playlistId: 1, newId: () => `new-${(counter += 1)}` });

test("entries in another order keep their own streams: nothing changes", () => {
  const rows = [row("A", "https://x/a"), row("B", "https://x/b"), row("C", "https://x/c")];
  const out = plan(rows, [item("C", "https://x/c"), item("A", "https://x/a"), item("B", "https://x/b")]);
  assert.deepEqual([out.creates.length, out.updates.length], [0, 0]);
});

test("a moved address (name alone, unambiguous) updates the row; a renamed entry (address alone) updates its sync name", () => {
  const rows = [row("A", "https://x/a"), row("B", "https://x/b")];
  const out = plan(rows, [item("A", "https://x/a-2"), item("Bee", "https://x/b")]);
  assert.equal(out.creates.length, 0);
  const [a, b] = out.updates;
  assert.deepEqual([a?.id, a?.streamUrl], [rows[0]?.id, "https://x/a-2"]);
  assert.deepEqual([b?.id, b?.syncName, b?.name], [rows[1]?.id, "Bee", "B"], "the display name stays");
});

test("two rows with one name are told apart by tvg-id; without it they are left alone and the entries are new", () => {
  const rows = [row("News", "https://x/1", { tvgId: "t1" }), row("News", "https://x/2", { tvgId: "t2" })];
  const tied = plan(rows, [item("News", "https://x/4", { tvgId: "t2" }), item("News", "https://x/3", { tvgId: "t1" })]);
  assert.deepEqual(tied.updates.map((r) => [r.id, r.streamUrl]), [[rows[1]?.id, "https://x/4"], [rows[0]?.id, "https://x/3"]]);
  const blind = plan(rows, [item("News", "https://x/4"), item("News", "https://x/3")]);
  assert.deepEqual([blind.creates.length, blind.updates.length], [2, 0], "ambiguous: no swapping, new rows");
});

test("an edited field is kept, the display name and enabled never change, a new entry is a disabled row", () => {
  const edited = row("A", "https://x/a", { name: "A HD", editedFields: ["name", "streamUrl", "category"], enabled: false, category: "Mine" });
  const out = plan([edited], [item("A", "https://x/a-2", { groupTitle: "Other", logoUrl: "https://img/a.png" }), item("Fresh", "https://x/f", { number: "7" })]);
  assert.deepEqual(out.updates.map((r) => [r.streamUrl, r.category, r.name, r.enabled, r.logoUrl]), [["https://x/a", "Mine", "A HD", false, "https://img/a.png"]]);
  const [fresh] = out.creates;
  assert.deepEqual([fresh?.enabled, fresh?.published, fresh?.number, fresh?.syncName, fresh?.playlistId, fresh?.status], [false, false, "7", "Fresh", 1, null]);
});

test("a row with no entry is never deleted, and an unchanged entry is no update", () => {
  const rows = [row("Gone", "https://x/g"), row("Stays", "https://x/s")];
  const out = plan(rows, [item("Stays", "https://x/s")]);
  assert.deepEqual([out.creates, out.updates], [[], []]);
});
