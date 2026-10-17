import { railKey } from "@/constants/tabs";
import type { Tab } from "@/types/shell";
import { olderRemaining } from "./audit-slice";
import { useAppStore } from "./app-store";

export const useTab = (): Tab => useAppStore((state) => state.tab);

/** Whether a tab's rail is committed open. A pane never recorded reads open, as the default. */
export const usePaneOpen = (tab: Tab): boolean => useAppStore((state) => state.open[railKey(tab)] ?? true);

/** True while a work surface (a modal child window) is open: the titlebar's pane toggles and the tabs sleep with it,
 *  because a control whose effect would land somewhere nobody can see reads as stuck. */
export const useWorkSurfaceOpen = (): boolean => useAppStore((state) => state.overlay !== null);

/** Whether the tab is showing a workspace (the rail exists) and not its index. */
export const useWorkspaceOpen = (tab: Tab): boolean => useAppStore((state) => state.workspaces[tab] !== null);

/** Whether the Events drawer has an older page to load. */
export const useOlderAvailable = (): boolean => useAppStore((state) => olderRemaining(state.olderLoaded));
