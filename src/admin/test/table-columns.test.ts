import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fitColumns, type RecordColumns } from "@giga/ui/lib/record-columns";
import { END_ACTIONS_PX, END_COLUMN_PX } from "@giga/ui/lib/window-constants";
import { accountColumns } from "@/components/accounts/account-columns";
import { channelColumns } from "@/components/channels/channel-columns";
import { jobColumns } from "@/components/jobs/job-columns";
import { deletedTitleColumns } from "@/components/titles/deleted-title-columns";
import { titleColumns } from "@/components/titles/title-columns";
import { playlistColumns } from "@/components/playlists/playlist-columns";
import { providerColumns } from "@/components/providers/provider-columns";
import { formatWhen } from "@/lib/format-when";

/* The index lists' column sets as arithmetic (`45` sections 2.3 and 5): unique ids, a growing column that is never hidden,
 * the hide order of the plan at a 900px window (a 842px scroller) with nothing wider than the pane, every column at a
 * 1264px window (1206px), and a mono date whole in its column. A render cannot measure a column; this can. */
const NARROW = 842;
const WIDE = 1206;
const MONO_12PX_PX = 7.2;

function shown<TData extends object>(columns: RecordColumns<TData>, width: number): string[] {
  return Object.entries(fitColumns(columns, width)).filter(([, on]) => on).map(([id]) => id);
}

const ids = (columns: ReadonlyArray<{ readonly id?: string }>): string[] => columns.map((one) => one.id ?? "");

interface Fact { readonly id: string; readonly size: number | undefined; readonly priority: number | undefined; readonly grow: number | undefined }
const facts = (columns: ReadonlyArray<{ readonly id?: string; readonly size?: number; readonly meta?: { readonly priority: number; readonly grow?: number } }>): Fact[] =>
  columns.map((one) => ({ id: one.id ?? "", size: one.size, priority: one.meta?.priority, grow: one.meta?.grow }));
const DELETED = facts(deletedTitleColumns);
const TABLES: Fact[][] = [
  facts(providerColumns), facts(accountColumns), facts(playlistColumns), facts(jobColumns), facts(channelColumns),
  facts(titleColumns), DELETED,
];

/** The order the columns disappear in as the pane narrows from 1,300px: each id once, widest first. */
function hideOrder<TData extends object>(columns: RecordColumns<TData>, options?: { tick: boolean; endPx: number }): string[] {
  const gone: string[] = [];
  for (let width = 1300; width >= 100; width -= 1) {
    for (const [id, on] of Object.entries(fitColumns(columns, width, options))) if (!on && !gone.includes(id)) gone.push(id);
  }
  return gone;
}

describe("the index tables' column sets", () => {
  it("every column has an id, unique within its table, a minimum size and a priority", () => {
    for (const table of TABLES) {
      assert.ok(table.every((one) => one.id !== "" && one.size !== undefined && one.priority !== undefined));
      assert.equal(new Set(table.map((one) => one.id)).size, table.length);
    }
  });

  it("every table has a growing column of priority 0 (the name), and a state column that is never hidden", () => {
    for (const table of TABLES) {
      assert.ok(table.some((one) => one.grow !== undefined && one.priority === 0));
      if (table !== DELETED) assert.equal(table.find((one) => one.id === "state")?.priority, 0);
    }
  });

  it("providers and accounts show every column at 842px and at 1206px", () => {
    assert.deepEqual(shown(providerColumns, NARROW), ids(providerColumns));
    assert.deepEqual(shown(accountColumns, NARROW), ids(accountColumns));
  });

  it("playlists: at 842px dead, live and enabled go (in that order), at 1206px all eight show", () => {
    assert.deepEqual(shown(playlistColumns, WIDE), ids(playlistColumns));
    assert.deepEqual(shown(playlistColumns, NARROW), ["name", "source", "channels", "last-run", "state"]);
    assert.deepEqual(shown(playlistColumns, 900), ["name", "source", "channels", "enabled", "last-run", "state"]);
    assert.deepEqual(shown(playlistColumns, 700), ["name", "channels", "last-run", "state"]);
  });

  it("jobs: at 842px last run and outcome go first, at 1206px all seven show; the state cell stays", () => {
    assert.deepEqual(shown(jobColumns, WIDE), ids(jobColumns));
    assert.deepEqual(shown(jobColumns, NARROW), ["name", "type", "target", "schedule", "state"]);
    assert.ok(shown(jobColumns, 300).includes("state") && shown(jobColumns, 300).includes("name"));
  });

  it("channels: all seven show at 1206px; at 842px now playing goes (the end cell is sized for two actions)", () => {
    const actions = { tick: true, endPx: END_ACTIONS_PX };
    const at = (width: number): string[] =>
      Object.entries(fitColumns(channelColumns, width, actions)).filter(([, on]) => on).map(([id]) => id);
    assert.deepEqual(at(WIDE), ids(channelColumns));
    assert.deepEqual(at(NARROW), ["name", "category", "kind", "state", "stream", "mode"]);
    assert.deepEqual(hideOrder(channelColumns, actions), ["now-playing", "mode", "category", "kind", "stream"]);
    assert.ok(at(300).includes("name") && at(300).includes("state"));
    assert.ok(END_ACTIONS_PX > END_COLUMN_PX);
  });

  it("channels: only name, category and kind sort on the server", () => {
    const sortable = channelColumns.filter((one) => one.enableSorting !== false).map((one) => one.id);
    assert.deepEqual(sortable, ["name", "category", "kind"]);
  });

  it("titles: all five show at 842px, and rating, year, kind go in that order when narrower; title and state stay", () => {
    assert.deepEqual(shown(titleColumns, WIDE), ids(titleColumns));
    assert.deepEqual(shown(titleColumns, NARROW), ids(titleColumns));
    assert.deepEqual(hideOrder(titleColumns), ["rating", "year", "kind"]);
    assert.deepEqual(shown(titleColumns, 100), ["title", "state"]);
  });

  it("deleted titles: all three show at 842px; kind goes before the date when narrower; the name stays", () => {
    assert.deepEqual(shown(deletedTitleColumns, NARROW), ids(deletedTitleColumns));
    assert.deepEqual(hideOrder(deletedTitleColumns), ["kind", "deleted"]);
    assert.deepEqual(shown(deletedTitleColumns, 100), ["name"]);
  });

  it("the date columns hold a formatted time (16 mono characters) whole", () => {
    const width = formatWhen(Date.UTC(2026, 9, 17, 21, 2)).length * MONO_12PX_PX;
    assert.equal(formatWhen(Date.UTC(2026, 9, 17, 21, 2)).length, 16);
    const size = (columns: ReadonlyArray<{ readonly id?: string; readonly size?: number }>, id: string): number =>
      columns.find((one) => one.id === id)?.size ?? 0;
    assert.ok(size(accountColumns, "last-sign-in") >= width);
    assert.ok(size(playlistColumns, "last-run") >= width);
    assert.ok(size(jobColumns, "last-run") >= width);
    assert.ok(size(deletedTitleColumns, "deleted") >= width);
  });
});
