import type { PaneEngine, PaneHost, PaneHostState } from "@giga/ui/panes/pane-types";
import { PANE_TABLE, STAGE_MIN } from "@/constants/tabs";
import { useAppStore, type AppState } from "./app-store";

/** The store as the pane engine reads it: the admin's tab is the engine's "surface". Everything else is the slice's own,
 *  by reference, so the engine's change tests see the same objects the store holds. */
function paneState(state: AppState): PaneHostState {
  return {
    surface: state.tab,
    open: state.open,
    sizes: state.sizes,
    openVersion: state.openVersion,
    togglePane: state.togglePane,
    say: state.say,
    commitSizes: state.commitSizes,
  };
}

export const PANE_HOST: PaneHost = {
  getState: () => paneState(useAppStore.getState()),
  subscribe: (listener) => useAppStore.subscribe((state, previous) => listener(paneState(state), paneState(previous))),
};

/** What the admin gives the family pane engine (`@giga/ui/panes/WorkspaceSplit`): its store and its tabs' limits. */
export const PANE_ENGINE: PaneEngine = { host: PANE_HOST, table: PANE_TABLE, stageMin: STAGE_MIN };
