import { MotionConfig } from "framer-motion";
import { useReduceMotion } from "@giga/ui/hooks/useReduceMotion";
import { useTheme } from "@giga/ui/hooks/useTheme";
import { useCaptionOverlay } from "@/hooks/useCaptionOverlay";
import { useShellKeys } from "@/hooks/useShellKeys";
import { useUiZoom } from "@/hooks/useUiZoom";
import { useAppStore } from "@/store/app-store";
import { AppShell } from "./AppShell";

/** The root: the session-long hooks are mounted here and only here (one theme stamp, one zoom, one caption strip, one
 *  keyboard listener), then the shell. `MotionConfig` carries the reduced-motion preference to every framer-motion tween
 *  as one setting. The caption overlay runs after the theme stamp: it reads the tokens the stamp selects. */
export function App() {
  const theme = useAppStore((state) => state.theme);
  const accent = useAppStore((state) => state.accent);
  const motion = useAppStore((state) => state.motion);
  useTheme({ theme, accent, motion });
  useUiZoom();
  useCaptionOverlay();
  useShellKeys();
  const reduced = useReduceMotion();

  return (
    <MotionConfig reducedMotion={reduced ? "always" : "never"}>
      <AppShell />
    </MotionConfig>
  );
}
