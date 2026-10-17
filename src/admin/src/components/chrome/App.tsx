import { MotionConfig } from "framer-motion";
import { useReduceMotion } from "@giga/ui/hooks/useReduceMotion";
import { useShellKeyboard } from "@/hooks/useShellKeyboard";
import { useTheme } from "@/hooks/useTheme";
import { AppShell } from "./AppShell";

/** The root: the session-long hooks are mounted here and only here (one theme stamp, one keyboard listener), then
 *  the shell. `MotionConfig` carries the reduced-motion preference to every framer-motion tween as one setting. */
export function App() {
  useTheme();
  useShellKeyboard();
  const reduced = useReduceMotion();

  return (
    <MotionConfig reducedMotion={reduced ? "always" : "never"}>
      <AppShell />
    </MotionConfig>
  );
}
