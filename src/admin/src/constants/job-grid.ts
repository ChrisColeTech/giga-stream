import type { GridHeading } from "@giga/ui/lists/RecordGrid";
import type { GridLayout } from "@giga/ui/lists/record-grid-layout";

/** The Jobs list's column set (`38` section 4.2): name, type, target, schedule, last run, outcome, state. The state
 *  track holds the word and, while a job runs, the pulsing 48px bar beside it. */
export const JOB_GRID: GridLayout = {
  tracks: ["minmax(10rem,1.3fr)", "5.5rem", "minmax(8rem,1fr)", "5rem", "9.5rem", "minmax(10rem,1.4fr)", "8.5rem"],
  end: "14rem",
  minWidth: "84rem",
};

export const JOB_HEADINGS: readonly GridHeading[] = [
  { key: "name", label: "name" },
  { key: "type", label: "type" },
  { key: "target", label: "target" },
  { key: "schedule", label: "schedule" },
  { key: "last-run", label: "last run" },
  { key: "outcome", label: "outcome" },
  { key: "state", label: "state" },
];
