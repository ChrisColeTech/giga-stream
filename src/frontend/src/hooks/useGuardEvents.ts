import { useEffect } from "react";
import { installGuardEvents } from "@/services/guard-events";

/** Owns the session-long Electron guard subscription. */
export function useGuardEvents(): void {
  useEffect(() => installGuardEvents(), []);
}
