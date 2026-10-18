import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GridHeading } from "@giga/ui/lists/RecordGrid";
import { TICK_TRACK, type GridLayout } from "@giga/ui/lists/record-grid-layout";
import { ACCOUNT_GRID, ACCOUNT_HEADINGS } from "@/constants/account-grid";
import { CHANNEL_GRID, CHANNEL_HEADINGS } from "@/constants/channel-grid";
import { JOB_GRID, JOB_HEADINGS } from "@/constants/job-grid";
import { PLAYLIST_GRID, PLAYLIST_HEADINGS } from "@/constants/playlist-grid";
import { PROVIDER_GRID, PROVIDER_HEADINGS } from "@/constants/provider-grid";
import { DELETED_GRID, DELETED_HEADINGS, TITLE_GRID, TITLE_HEADINGS } from "@/constants/title-grid";
import { formatWhen } from "@/lib/format-when";

/* The index lists' column sets as arithmetic: one track per cell (an extra track is an empty column that squeezes the
 * others), `minWidth` no smaller than the tracks' own minimums plus the row's gaps and padding (else the cells overflow
 * their tracks), and a mono date whole in its track. A render cannot measure a column; this can. */
const REM = 16;
const GAP_REM = 0.75;
const PADDING_REM = 1.5;
const MONO_12PX_REM = 7.2 / REM;
const rem = (value: string): number => Number.parseFloat(value.replace("minmax(", ""));

const LISTS: ReadonlyArray<readonly [string, GridLayout, readonly GridHeading[]]> = [
  ["accounts", ACCOUNT_GRID, ACCOUNT_HEADINGS],
  ["channels", CHANNEL_GRID, CHANNEL_HEADINGS],
  ["jobs", JOB_GRID, JOB_HEADINGS],
  ["playlists", PLAYLIST_GRID, PLAYLIST_HEADINGS],
  ["providers", PROVIDER_GRID, PROVIDER_HEADINGS],
  ["titles", TITLE_GRID, TITLE_HEADINGS],
  ["deleted titles", DELETED_GRID, DELETED_HEADINGS],
];

const needed = (layout: GridLayout): number => {
  const columns = layout.tracks.length + 2;
  return rem(TICK_TRACK) + layout.tracks.reduce((sum, track) => sum + rem(track), 0) + rem(layout.end) + (columns - 1) * GAP_REM + PADDING_REM;
};

describe("the index list grids", () => {
  for (const [name, layout, headings] of LISTS) {
    it(`${name}: one track for each heading and a minimum width that holds every track`, () => {
      assert.equal(layout.tracks.length, headings.length);
      assert.ok(rem(layout.minWidth) >= needed(layout), `${layout.minWidth} < ${needed(layout)}rem`);
    });
  }

  it("accounts: the last sign-in track holds a formatted time whole", () => {
    const track = ACCOUNT_GRID.tracks[2] ?? "";
    assert.equal(formatWhen(Date.UTC(2026, 9, 17, 21, 2)).length, 16);
    assert.ok(rem(track) >= 16 * MONO_12PX_REM, track);
  });

  it("jobs: the last run track holds a formatted time whole, and the list fits a 1264px window (1216px of page) with no sideways scroll", () => {
    assert.ok(rem(JOB_GRID.tracks[4] ?? "") >= 16 * MONO_12PX_REM);
    assert.ok(rem(JOB_GRID.minWidth) * REM <= 1200, JOB_GRID.minWidth);
  });

  it("playlists and deleted titles: the time track holds a formatted time whole", () => {
    assert.ok(rem(PLAYLIST_GRID.tracks[3] ?? "") >= 16 * MONO_12PX_REM);
    assert.ok(rem(DELETED_GRID.tracks[2] ?? "") >= 16 * MONO_12PX_REM);
  });
});
