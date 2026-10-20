import { isPopupOverlay } from "@/constants/popups";
import { paneKey } from "@/constants/surfaces";
import type { StoreInputs } from "@/services/persistence";
import type { PaneSide, Surface } from "@/types/shell";
import { useAppStore } from "./app-store";

export const useSurface = (): Surface => useAppStore((state) => state.surface);

/** The resolver's live session input (`62` section 3.6): read by the transport services at each call, so the storage
 *  home follows the session the moment it changes - never frozen at boot. */
export const sessionInputs = (): StoreInputs => ({ signedIn: useAppStore.getState().signedIn });

/** Whether a pane is committed open. A pane never recorded reads open, as the default. */
export const usePaneOpen = (surface: Surface, side: PaneSide): boolean =>
  useAppStore((state) => state.open[paneKey(surface, side)] ?? true);

/** True while a work surface (a modal child window) is open: the titlebar's pane toggles and page tabs sleep with it,
 *  because a control whose effect would land somewhere nobody can see reads as stuck. A popup covers nothing. */
export const useWorkSurfaceOpen = (): boolean =>
  useAppStore((state) => state.overlay !== null && !isPopupOverlay(state.overlay));
