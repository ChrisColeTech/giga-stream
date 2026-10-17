import type { PaneLimits, PaneTable } from "@giga/ui/panes/pane-types";
import type { PaneKey, Tab } from "@/types/shell";

export interface TabConfig {
  readonly id: Tab;
  readonly label: string;
  /** The tooltip of the tab while it works: `Channels (Ctrl+1)`. */
  readonly hint: string;
}

/** The tab pill, in order (`26` section 4.4). `Ctrl+1` to `Ctrl+6` pick them. */
export const TABS: readonly TabConfig[] = [
  { id: "channels", label: "Channels", hint: "Channels (Ctrl+1)" },
  { id: "providers", label: "Providers", hint: "Providers (Ctrl+2)" },
  { id: "titles", label: "Titles", hint: "Titles (Ctrl+3)" },
  { id: "playlists", label: "Playlists", hint: "Playlists (Ctrl+4)" },
  { id: "jobs", label: "Jobs", hint: "Jobs (Ctrl+5)" },
  { id: "accounts", label: "Accounts", hint: "Accounts (Ctrl+6)" },
];

export const TAB_ORDER: readonly Tab[] = TABS.map((tab) => tab.id);

export const DEFAULT_TAB: Tab = "channels";

/** The accessible name of the tab pill. */
export const TAB_PILL_LABEL = "Sections";

/** The tab pill asleep while signed out: why, as the track's tooltip. */
export const SIGN_IN_FIRST = "Sign in first";

/** The one side pane every tab has: a workspace's rail (`28` section 7.2). Pixels; the sash drags between the limits. */
export const RAIL_LIMITS: PaneLimits = { min: 190, max: 380, preferred: 240 };

/** The floor of a tab's centre: the page keeps this much width before the rail gives way. */
export const CENTER_MIN = 480;

/** The engine's floor for a bottom pane's row. The admin has no bottom pane, so nothing reads it. */
export const STAGE_MIN = 0;

/** The limits table the pane engine reads (`@giga/ui/panes/WorkspaceSplit`): every tab has a left pane and no right or
 *  bottom one. The admin's tabs are the engine's "surfaces". */
export const PANE_TABLE: PaneTable = Object.fromEntries(
  TAB_ORDER.map((tab) => [tab, { centerMin: CENTER_MIN, panes: { left: RAIL_LIMITS, right: null, bottom: null } }]),
);

/** The pane key of a tab's rail. */
export const railKey = (tab: Tab): PaneKey => `${tab}.left`;
