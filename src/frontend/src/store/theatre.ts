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

/** Entering Theatre collapses every open pane of the current surface by the ordinary toggle and changes the bar
 *  colour. Leaving only changes the colour back: no pane is touched, and the user reopens them with the toggles
 *  (owner, 2026-10-17). The idle flag leaves with Theatre in the same transition, so the bars can never stay hidden
 *  outside it. */
export function toggleTheatre(set: Set, get: Get): void {
  if (get().theatre) {
    set({ theatre: false, chromeIdle: false });
    return;
  }
  for (const side of SIDES) {
    if (SURFACES[get().surface].panes[side] === null) continue;
    if (get().open[paneKey(get().surface, side)] ?? true) get().togglePane(side);
  }
  set({ theatre: true, chromeIdle: false });
}
