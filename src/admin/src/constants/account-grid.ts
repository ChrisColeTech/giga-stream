import type { GridHeading } from "@giga/ui/lists/RecordGrid";
import type { GridLayout } from "@giga/ui/lists/record-grid-layout";

/** The Accounts list's column set (`35` section 5.8), one track for each cell (username, state, last sign-in). Tracks are
 *  rem so the header and the rows line up. The last sign-in track holds the 16 mono characters of `formatWhen` whole. The
 *  end track fits the armed question for a long address (`Delete someone@example.test?`). */
export const ACCOUNT_GRID: GridLayout = {
  tracks: ["minmax(12rem,1.6fr)", "7rem", "minmax(9.5rem,1fr)"],
  end: "15rem",
  minWidth: "50rem",
};

/** THE SLOT FOR THE ID COLUMN. Accounts will get a generated integer id from a backend sequence (migration 018); the
 *  column lands in a follow-up after that backend work merges, as a heading here, a track in `ACCOUNT_GRID.tracks` and a
 *  cell in `AccountRows`, reading the id the backend sends (`AccountId`, `types/admin-account.ts`). The client never
 *  derives or invents an id, so until then this is null and the list has no such column. */
export const ACCOUNT_ID_COLUMN: GridHeading | null = null;

export const ACCOUNT_HEADINGS: readonly GridHeading[] = [
  ...(ACCOUNT_ID_COLUMN === null ? [] : [ACCOUNT_ID_COLUMN]),
  { key: "username", label: "username" },
  { key: "state", label: "state" },
  { key: "last-sign-in", label: "last sign-in" },
];
