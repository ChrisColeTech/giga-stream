import { focusFirstShown, useShellKeys, type ShellKeyMap, type ShellKeyContext } from "@giga/ui/hooks/useShellKeys";
import { useAppStore } from "@/store/app-store";
import type { Surface } from "@/types/shell";

/** The shell's actions, by the id the shared key map resolves a press to. */
type ShellAction = Surface | "settings" | "search" | "zoom-reset" | "close-events";

/** `02` section 6: Ctrl+1, 2, 3 switch to Live, Library and Player; Ctrl+, opens Settings; Ctrl+F focuses the active
 *  surface's search; Ctrl+0 resets the zoom and works under an open window (its zoom row is in Settings,
 *  `06` section 6.2); Escape closes the events drawer when no flow is open. */
const SHELL_KEYS: ShellKeyMap<ShellAction> = {
  ctrl: { "1": "live", "2": "library", "3": "player", ",": "settings", f: "search" },
  ctrlAlways: { "0": "zoom-reset" },
  escape: "close-events",
};

/** 1 is 100% in the store (`06` section 8). */
const ZOOM_RESET = 1;

function run(id: ShellAction): boolean {
  const state = useAppStore.getState();
  if (id === "live" || id === "library" || id === "player") {
    state.setSurface(id);
    return true;
  }
  if (id === "settings") {
    state.openOverlay("settings");
    return true;
  }
  if (id === "search") return focusFirstShown("[data-search]");
  if (id === "zoom-reset") {
    state.setZoom(ZOOM_RESET);
    state.say("Zoom reset to 100%.");
    return true;
  }
  state.toggleEvents();
  return true;
}

function context(): ShellKeyContext {
  const state = useAppStore.getState();
  return { windowOpen: state.overlay !== null, drawerOpen: state.eventsOpen };
}

/** The interface's shell keys: the shared listener with the interface's map and actions. */
export function useShellKeyboard(): void {
  useShellKeys({ map: SHELL_KEYS, context, run });
}
