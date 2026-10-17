import { MotionConfig } from "framer-motion";
import { useAppHydration } from "@/hooks/useAppHydration";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { useSettingsWriteback } from "@/hooks/useSettingsWriteback";
import { useShellKeyboard } from "@/hooks/useShellKeyboard";
import { useShellWriteback } from "@/hooks/useShellWriteback";
import { useTheme } from "@/hooks/useTheme";
import { useAppStore } from "@/store/app-store";
import { AppShell } from "./AppShell";

/** The root: the session-long hooks are mounted here and only here (one theme stamp, one keyboard listener), then
 *  the shell. `MotionConfig` carries the reduced-motion preference to every framer-motion tween as one setting. */
export function App() {
  useAppHydration();
  useShellWriteback();
  useSettingsWriteback();
  useTheme();
  useShellKeyboard();
  const reduced = useReduceMotion();
  const visible = useAppStore((state) => state.shellVisible);

  return (
    <MotionConfig reducedMotion={reduced ? "always" : "never"}>
      <div className={visible ? "h-full" : "invisible h-full"}>
        <AppShell />
      </div>
    </MotionConfig>
  );
}
