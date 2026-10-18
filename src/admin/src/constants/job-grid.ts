import type { GridHeading } from "@giga/ui/lists/RecordGrid";
import type { GridLayout } from "@giga/ui/lists/record-grid-layout";

/** The Jobs list's column set (`38` section 4.2): name, type, target, schedule, last run, outcome, state. The state
 *  track holds the word and, while a job runs, the pulsing 48px bar beside it. Tightened so the list fits the 1264px
 *  window whole (1216px of page) and scrolls sideways only below `minWidth`; the elastic columns (name, target,
 *  outcome) end in an ellipsis with their full text as a tooltip, the fixed ones (type, schedule, last run, state)
 *  never do. */
export const JOB_GRID: GridLayout = {
  tracks: ["minmax(9rem,1.3fr)", "5rem", "minmax(6.5rem,1fr)", "8rem", "9rem", "minmax(7rem,1.4fr)", "8rem"],
  end: "12rem",
  minWidth: "74rem",
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
