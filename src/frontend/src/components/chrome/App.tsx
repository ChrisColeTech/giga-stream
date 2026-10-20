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
import { GateWall } from "@/components/gate/GateWall";
import { AppShell } from "./AppShell";

/** The root: the session-long hooks are mounted here and only here (one theme stamp, one keyboard listener, one guard
 *  receiver, one boot restore), then the shell - always (`63` section 3.1): browsing signed out is the app's default
 *  state, so the shell stays mounted and the Account control opens the gate over it as the admin console's
 *  full-screen wall (`34` sections 2 and 4), rendered outside the inert shell wrapper. The boot restore stays
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
  const gateOpen = useAppStore((state) => state.gateOpen);
  const closeGate = useAppStore((state) => state.closeGate);
  const setSurface = useAppStore((state) => state.setSurface);

  return (
    <MotionConfig reducedMotion={reduced ? "always" : "never"}>
      <div className={visible ? "h-full" : "invisible h-full"} inert={gateOpen || undefined} aria-hidden={gateOpen || undefined}>
        <AppShell />
      </div>
      {gateOpen && <GateWall onClose={closeGate} onBack={() => { setSurface("live"); closeGate(); }} />}
    </MotionConfig>
  );
}
