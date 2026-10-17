import { SIDES, SURFACES, SURFACE_ORDER, paneKey } from "@/constants/surfaces";
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

/** Closes every pane of every surface (a side a surface does not have is skipped) in ONE update of the `open` map,
 *  bumping the versions once, as `togglePane` does, so the writeback and the pane animation see a single change. */
export function collapseAllPanes(set: Set, get: Get): void {
  const state = get();
  const open = { ...state.open };
  for (const surface of SURFACE_ORDER) {
    for (const side of SIDES) {
      if (SURFACES[surface].panes[side] !== null) open[paneKey(surface, side)] = false;
    }
  }
  set({ open, openVersion: state.openVersion + 1, shellRevision: state.shellRevision + 1 });
}

/** Entering Theatre collapses every pane of every surface and changes the bar colour, so another surface opened
 *  meanwhile finds its panes already collapsed. Leaving only turns the lights back on: no pane is touched, and the
 *  user reopens them with the toggles (owner, 2026-10-17). The idle flag leaves with Theatre in the same transition,
 *  so the bars can never stay hidden outside it. */
export function toggleTheatre(set: Set, get: Get): void {
  if (get().theatre) {
    set({ theatre: false, chromeIdle: false });
    return;
  }
  collapseAllPanes(set, get);
  set({ theatre: true, chromeIdle: false });
}
