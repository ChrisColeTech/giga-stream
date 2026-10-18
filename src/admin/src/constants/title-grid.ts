import type { GridHeading } from "@giga/ui/lists/RecordGrid";
import type { GridLayout } from "@giga/ui/lists/record-grid-layout";

/** The Titles list's column set (`37` section 4.2; the mockup's `#gridTitles`). Tracks are rem so the header and the
 *  rows line up; the end track fits the armed question for a long title. */
export const TITLE_GRID: GridLayout = {
  tracks: ["minmax(12rem,2fr)", "5.5rem", "4rem", "4rem", "6rem"],
  end: "13rem",
  minWidth: "52rem",
};

export const TITLE_HEADINGS:readonly GridHeading[] = [
  { key: "title", label: "title" },
  { key: "kind", label: "kind" },
  { key: "year", label: "year", align: "right" },
  { key: "rating", label: "rating", align: "right" },
  { key: "state", label: "state" },
];
