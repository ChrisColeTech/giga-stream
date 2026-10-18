import type { GridHeading } from "@giga/ui/lists/RecordGrid";
import type { GridLayout } from "@giga/ui/lists/record-grid-layout";

/** The Providers list's column set (`37` section 3.2; the mockup's `#gridProviders`). Tracks are rem so the header and
 *  the rows line up; the end track fits the armed question for a long name. */
export const PROVIDER_GRID: GridLayout = {
  tracks: ["3.5rem", "minmax(10rem,1.4fr)", "minmax(7rem,1fr)", "6rem", "6rem"],
  end: "13rem",
  minWidth: "52rem",
};

export const PROVIDER_HEADINGS: readonly GridHeading[] = [
  { key: "order", label: "order", align: "right" },
  { key: "name", label: "name" },
  { key: "source", label: "source" },
  { key: "family", label: "family" },
  { key: "state", label: "state" },
];
