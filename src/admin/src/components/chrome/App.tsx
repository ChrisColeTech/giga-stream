import { MotionConfig } from "framer-motion";
import { useReduceMotion } from "@giga/ui/hooks/useReduceMotion";
import { focusFirstShown, useShellKeys, type ShellKeyContext, type ShellKeyMap } from "@giga/ui/hooks/useShellKeys";
import { useTheme } from "@giga/ui/hooks/useTheme";
import { useAppStore } from "@/store/app-store";
import type { Surface } from "@/types/shell";
import { AppShell } from "./AppShell";

/** The shell's actions, by the id the shared key map resolves a press to. */
type ShellAction = Surface | "settings" | "search" | "zoom-reset" | "close-events";

/** The shell's keys (`02` section 6), as the demo shell has them: Ctrl+1..3 switch surfaces, Ctrl+, opens Settings,
 *  Ctrl+F focuses the search, Ctrl+0 resets the zoom under a window, Escape closes the events drawer. */
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

/** The root: the session-long hooks are mounted here and only here (one theme stamp, one keyboard listener), then
 *  the shell. `MotionConfig` carries the reduced-motion preference to every framer-motion tween as one setting. */
export function App() {
  const theme = useAppStore((state) => state.theme);
  const accent = useAppStore((state) => state.accent);
  const motion = useAppStore((state) => state.motion);
  useTheme({ theme, accent, motion });
  useShellKeys({ map: SHELL_KEYS, context, run });
  const reduced = useReduceMotion();

  return (
    <MotionConfig reducedMotion={reduced ? "always" : "never"}>
      <AppShell />
    </MotionConfig>
  );
}
