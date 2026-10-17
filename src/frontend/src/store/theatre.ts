import { SIDES, SURFACES, paneKey } from "@/constants/surfaces";
import type { PaneSide } from "@/types/shell";
import type { AppState } from "./app-store";

type Set = (partial: Partial<AppState>) => void;
type Get = () => AppState;

export function togglePane(set: Set, get: Get, side: PaneSide): void {
  const state = get();
  if (SURFACES[state.surface].panes[side] === null) return;
  const key = paneKey(state.surface, side);
  set({
    open: { ...state.open, [key]: !(state.open[key] ?? true) },
    openVersion: state.openVersion + 1,
    shellRevision: state.shellRevision + 1,
  });
}

/** Theatre collapses the panes by the ordinary toggle and remembers each side's prior state; exiting heals
 *  every side back to what it was, however it was changed while Theatre was on. */
export function toggleTheatre(set: Set, get: Get): void {
  if (!get().theatre) {
    const before: Partial<Record<PaneSide, boolean>> = {};
    for (const side of SIDES) {
      if (SURFACES[get().surface].panes[side] === null) continue;
      const key = paneKey(get().surface, side);
      const open = get().open[key] ?? true;
      before[side] = open;
      if (open) get().togglePane(side);
    }
    set({ theatre: true, theatreBefore: before, chromeIdle: false });
    return;
  }
  const before = get().theatreBefore ?? {};
  for (const side of SIDES) {
    const desired = before[side];
    if (desired === undefined) continue;
    if ((get().open[paneKey(get().surface, side)] ?? true) !== desired) get().togglePane(side);
  }
  /* The idle flag leaves with Theatre in the same transition, so the bars can never stay hidden outside it. */
  set({ theatre: false, theatreBefore: null, chromeIdle: false });
}
