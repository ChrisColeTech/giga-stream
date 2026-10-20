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
import { SignInGate } from "@/components/gate/SignInGate";
import { installGuardEvents } from "@/services/guard-events";
import { useAppStore } from "@/store/app-store";
import { AppShell } from "./AppShell";

/** The root: the session-long hooks are mounted here and only here (one theme stamp, one keyboard listener, one guard
 *  receiver, one boot restore), then the gate or the shell (`62` section 3.5) - the gate replaces the three surfaces
 *  while no session is held and the desktop has not gone offline; behind it the app is as it was. `MotionConfig`
 *  carries the reduced-motion preference to every framer-motion tween as one setting. */
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
  const gating = useAppStore((state) => !state.signedIn && !state.offline);
  const visible = useAppStore((state) => state.shellVisible);

  return (
    <MotionConfig reducedMotion={reduced ? "always" : "never"}>
      {gating ? (
        <SignInGate />
      ) : (
        <div className={visible ? "h-full" : "invisible h-full"}>
          <AppShell />
        </div>
      )}
    </MotionConfig>
  );
}
