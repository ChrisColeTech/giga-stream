import { focusFirstShown } from "@giga/ui/hooks/useShellKeys";
import type { ShellAction } from "@/constants/shell-keys";
import type { AppState } from "@/store/app-store";

/** The zoom `Ctrl+0` returns to: 1 is 100% in the store. */
const ZOOM_RESET = 1;

const SEARCH_FIELD = "[data-search]";

/** Does what a shell key asks, against the store state it is handed. True when the press was used, so the shell
 *  prevents the browser's own meaning of it. The tabs do nothing while signed out (their pill is asleep). */
export function runShellAction(action: ShellAction, state: AppState): boolean {
  switch (action) {
    case "settings":
      state.openOverlay("settings");
      return true;
    case "search":
      return focusFirstShown(SEARCH_FIELD);
    case "zoom-reset":
      state.setZoom(ZOOM_RESET);
      return true;
    case "close-events":
      state.toggleEvents();
      return true;
    default:
      if (!state.signedIn) return false;
      state.setTab(action);
      return true;
  }
}
