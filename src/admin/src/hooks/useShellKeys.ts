import { useShellKeys as useLibraryShellKeys, type ShellKeyContext } from "@giga/ui/hooks/useShellKeys";
import { SHELL_KEYS } from "@/constants/shell-keys";
import { runShellAction } from "@/lib/shell-actions";
import { useAppStore } from "@/store/app-store";

/** What is open at the moment of a press, read from the store then and not before. */
function context(): ShellKeyContext {
  const state = useAppStore.getState();
  return { windowOpen: state.overlay !== null, drawerOpen: state.eventsOpen };
}

/** The admin's shell keys on the library's key-map hook (`02` section 6): mounted once, in `App`. */
export function useShellKeys(): void {
  useLibraryShellKeys({ map: SHELL_KEYS, context, run: (action) => runShellAction(action, useAppStore.getState()) });
}
