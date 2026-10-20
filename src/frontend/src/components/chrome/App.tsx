import { MotionConfig } from "framer-motion";
import { useEffect } from "react";
import { useAppHydration } from "@/hooks/useAppHydration";
import { useNativeOverlay } from "@/hooks/useNativeOverlay";
import { useSessionRestore } from "@/hooks/useSessionRestore";
import { useReduceMotion } from "@giga/ui/hooks/useReduceMotion";
import { useSettingsWriteback } from "@/hooks/useSettingsWriteback";
import { useShellKeyboard } from "@/hooks/useShellKeyboard";
import { useShellWriteback } from "@/hooks/useShellWriteback";
import { useTheatreIdle } from "@/hooks/useTheatreIdle";
import { useTheme } from "@/hooks/useTheme";
import { installGuardEvents } from "@/services/guard-events";
import { useAppStore } from "@/store/app-store";
import { AppShell } from "./AppShell";

/** The root: the session-long hooks are mounted here and only here (one theme stamp, one keyboard listener, one guard
 *  receiver, one boot restore), then the shell - always (`63` section 3.1): the gate is no wall but the Account
 *  control's dialog in the titlebar, and browsing signed out is the app's default state. The boot restore stays
 *  silent: the shell shows once hydration has settled, signed in or not. `MotionConfig` carries the reduced-motion
 *  preference to every framer-motion tween as one setting. */
export function App() {
  useAppHydration();
  useSessionRestore();
  useShellWriteback();
  useSettingsWriteback();
  useTheme();
  useTheatreIdle();
  useNativeOverlay();
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
