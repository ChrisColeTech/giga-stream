import { isPopupOverlay } from "@/constants/popups";
import { STAGE_MIN_HEIGHT, SURFACES, paneKey } from "@/constants/surfaces";
import type { PaneSide, Surface } from "@/types/shell";
import type { PaneEngine } from "@giga/ui/panes/pane-types";
import { useAppStore } from "./app-store";

/** What the admin gives the family pane engine (`@giga/ui/panes/WorkspaceSplit`): its store and its surfaces' limits. */
export const PANE_ENGINE: PaneEngine = { host: useAppStore, table: SURFACES, stageMin: STAGE_MIN_HEIGHT };

export const useSurface = (): Surface => useAppStore((state) => state.surface);

/** Whether a pane is committed open. A pane never recorded reads open, as the default. */
export const usePaneOpen = (surface: Surface, side: PaneSide): boolean =>
  useAppStore((state) => state.open[paneKey(surface, side)] ?? true);

/** True while a work surface (a modal child window) is open: the titlebar's pane toggles and page tabs sleep with it,
 *  because a control whose effect would land somewhere nobody can see reads as stuck. A popup covers nothing. */
export const useWorkSurfaceOpen = (): boolean =>
  useAppStore((state) => state.overlay !== null && !isPopupOverlay(state.overlay));
