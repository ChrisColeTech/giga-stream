import { useCallback, useSyncExternalStore } from "react";
import { paneKey } from "../panes/pane-limits";
import type { PaneHost, PaneSide } from "../panes/pane-types";

/** Whether a pane is committed open, read from the program's store. A pane never recorded reads open, as the default. */
export function usePaneOpen(host: PaneHost, surface: string, side: PaneSide): boolean {
  const key = paneKey(surface, side);
  const subscribe = useCallback((onChange: () => void) => host.subscribe(() => onChange()), [host]);
  const read = (): boolean => host.getState().open[key] ?? true;
  return useSyncExternalStore(subscribe, read, read);
}
