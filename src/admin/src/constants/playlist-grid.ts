import type { GridHeading } from "@giga/ui/lists/RecordGrid";
import type { GridLayout } from "@giga/ui/lists/record-grid-layout";

/** The Playlists list's column set (`38` section 3.2): name, host, channels, last synced, state. Tracks are rem so the
 *  header and the rows line up; the end track fits the armed question for a long name. */
export const PLAYLIST_GRID: GridLayout = {
  tracks: ["minmax(10rem,1.4fr)", "minmax(9rem,1fr)", "5.5rem", "9.5rem", "6rem"],
  end: "15rem",
  minWidth: "63rem",
};

export const PLAYLIST_HEADINGS: readonly GridHeading[] = [
  { key: "name", label: "name" },
  { key: "host", label: "host" },
  { key: "channels", label: "channels", align: "right" },
  { key: "last-synced", label: "last synced" },
  { key: "state", label: "state" },
];
