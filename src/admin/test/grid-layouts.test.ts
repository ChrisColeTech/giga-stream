import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GridHeading } from "@giga/ui/lists/RecordGrid";
import { TICK_TRACK, type GridLayout } from "@giga/ui/lists/record-grid-layout";
import { CHANNEL_GRID, CHANNEL_HEADINGS } from "@/constants/channel-grid";
import { TITLE_GRID, TITLE_HEADINGS } from "@/constants/title-grid";

/* The index lists' column sets as arithmetic: one track per cell (an extra track is an empty column that squeezes the
 * others), `minWidth` no smaller than the tracks' own minimums plus the row's gaps and padding (else the cells overflow
 * their tracks), and a mono date whole in its track. A render cannot measure a column; this can. */

const GAP_REM = 0.75;
const PADDING_REM = 1.5;
const rem = (value: string): number => Number.parseFloat(value.replace("minmax(", ""));

const LISTS: ReadonlyArray<readonly [string, GridLayout, readonly GridHeading[]]> = [
  ["channels", CHANNEL_GRID, CHANNEL_HEADINGS],
  ["titles", TITLE_GRID, TITLE_HEADINGS],
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
});
