import type { GridHeading } from "@giga/ui/lists/RecordGrid";
import type { GridLayout } from "@giga/ui/lists/record-grid-layout";

/** The Titles list's column set (`37` section 4.2; the mockup's `#gridTitles`). Tracks are rem so the header and the
 *  rows line up; the end track fits the armed question for a long title. */
export const TITLE_GRID: GridLayout = {
  tracks: ["minmax(14rem,2fr)", "5.5rem", "4rem", "4rem", "6rem"],
  end: "14rem",
  minWidth: "52rem",
};

/** The Deleted titles list (`37` section 4.4): the name first, then the kind and when it was deleted. */
export const DELETED_GRID: GridLayout = {
  tracks: ["minmax(14rem,2fr)", "5.5rem", "10rem"],
  end: "6rem",
  minWidth: "40rem",
};

export const DELETED_HEADINGS: readonly GridHeading[] = [
  { key: "name", label: "name" },
  { key: "kind", label: "kind" },
  { key: "deleted", label: "deleted" },
];

export const TITLE_HEADINGS:readonly GridHeading[] = [
  { key: "title", label: "title" },
  { key: "kind", label: "kind" },
  { key: "year", label: "year", align: "right" },
  { key: "rating", label: "rating", align: "right" },
  { key: "state", label: "state" },
];
