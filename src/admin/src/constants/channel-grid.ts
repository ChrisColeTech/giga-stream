import type { GridHeading } from "@giga/ui/lists/RecordGrid";
import type { GridLayout } from "@giga/ui/lists/record-grid-layout";

/** The Channels list's column set (`36` section 5.2, the mockup's `#gridChannels`). Tracks are rem so the header and the
 *  rows line up; below the minimum width the list scrolls sideways inside its own group, never the page. The end track
 *  fits the armed question for a long name (`Delete Fixture Entertainment?`). */
export const CHANNEL_GRID: GridLayout = {
  tracks: ["minmax(9rem,1.4fr)", "7rem", "4rem", "6rem", "6rem", "4.5rem", "minmax(8rem,1.2fr)"],
  end: "15rem",
  minWidth: "69rem",
};

export const CHANNEL_HEADINGS: readonly GridHeading[] = [
  { key: "name", label: "name", sortable: true },
  { key: "category", label: "category", sortable: true },
  { key: "kind", label: "kind", sortable: true },
  { key: "state", label: "state" },
  { key: "stream", label: "stream" },
  { key: "mode", label: "mode" },
  { key: "now-playing", label: "now playing" },
];
