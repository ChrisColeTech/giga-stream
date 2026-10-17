import { PANE_TABLE, TAB_ORDER, railKey } from "@/constants/tabs";
import { limitsOf, paneKey } from "@giga/ui/panes/pane-limits";
import type { PaneSide, Tab } from "@/types/shell";

type Flags = Readonly<Partial<Record<string, boolean>>>;
type Sizes = Readonly<Partial<Record<string, number>>>;

/* The library pane engine's contract for the admin's left panes (`PaneHostState` of `@giga/ui/panes/pane-types`): which
 * rails are open, the sizes the sash left them at, and a counter the engine tweens on. The tab is the engine's "surface". */
export interface PanesSlice {
  /** Committed visibility per pane key (`<tab>.left`); a pane never recorded reads open. */
  open: Flags;
  /** Committed size per pane key, in pixels. */
  sizes: Sizes;
  /** Bumped by every open change so the engine travels for a toggle and never for a drag. */
  openVersion: number;
  /** Shows or hides the active tab's rail. A side the admin has no pane on is ignored. */
  togglePane: (side: PaneSide) => void;
  /** Called once on drag end, never per pointer move. A size change is not an open change. */
  commitSizes: (patch: Sizes) => void;
}

interface Host {
  tab: Tab;
}

type Set = (partial: Partial<PanesSlice>) => void;
type Get = () => PanesSlice & Host;

function initialPanes(): Pick<PanesSlice, "open" | "sizes"> {
  const open: Record<string, boolean> = {};
  const sizes: Record<string, number> = {};
  for (const tab of TAB_ORDER) {
    const limits = limitsOf(PANE_TABLE, tab, "left");
    if (limits === null) continue;
    open[railKey(tab)] = true;
    sizes[railKey(tab)] = limits.preferred;
  }
  return { open, sizes };
}

export function panesSlice(set: Set, get: Get): PanesSlice {
  return {
    ...initialPanes(),
    openVersion: 0,
    togglePane: (side) => {
      const { tab, open, openVersion } = get();
      if (limitsOf(PANE_TABLE, tab, side) === null) return;
      const key = paneKey(tab, side);
      set({ open: { ...open, [key]: !(open[key] ?? true) }, openVersion: openVersion + 1 });
    },
    commitSizes: (patch) => set({ sizes: { ...get().sizes, ...patch } }),
  };
}
