import { MotionConfig } from "framer-motion";
import { useEffect } from "react";
import { useAppHydration } from "@/hooks/useAppHydration";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { useSettingsWriteback } from "@/hooks/useSettingsWriteback";
import { useShellKeyboard } from "@/hooks/useShellKeyboard";
import { useShellWriteback } from "@/hooks/useShellWriteback";
import { useTheme } from "@/hooks/useTheme";
import { installGuardEvents } from "@/services/guard-events";
import { useAppStore } from "@/store/app-store";
import { AppShell } from "./AppShell";

/** The root: the session-long hooks are mounted here and only here (one theme stamp, one keyboard listener, one guard
 *  receiver), then the shell. `MotionConfig` carries the reduced-motion preference to every framer-motion tween as one
 *  setting. */
export function App() {
  useAppHydration();
  useShellWriteback();
  useSettingsWriteback();
  useTheme();
  useShellKeyboard();
  useEffect(() => installGuardEvents(), []);
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
