import type { GridHeading } from "@giga/ui/lists/RecordGrid";
import type { GridLayout } from "@giga/ui/lists/record-grid-layout";

/** The Playlists list's column set (`43` section 4.1): name, source (the masked host or the file name), the four counts,
 *  last run, state. Tracks are rem so the header and the rows line up; the end track fits the armed question
 *  (`Delete <name> and its 2,598 channels?`) for a long name. */
export const PLAYLIST_GRID: GridLayout = {
  tracks: [
    "minmax(8rem,1.4fr)", "minmax(8rem,1fr)", "5.5rem", "5rem", "4rem", "4rem", "9.5rem", "5.5rem",
  ],
  end: "20rem",
  minWidth: "80rem",
};

export const PLAYLIST_HEADINGS: readonly GridHeading[] = [
  { key: "name", label: "name" },
  { key: "source", label: "source" },
  { key: "channels", label: "channels", align: "right" },
  { key: "enabled", label: "enabled", align: "right" },
  { key: "live", label: "live", align: "right" },
  { key: "dead", label: "dead", align: "right" },
  { key: "last-run", label: "last run" },
  { key: "state", label: "state" },
];
