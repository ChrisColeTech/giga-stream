import { useSyncExternalStore } from "react";
import { REDUCED_MOTION_QUERY } from "../lib/motion-timing";

/** "system" follows the OS, "off" always animates (the default), "on" never does. */
export type MotionPreference = "system" | "off" | "on";

/** Whether motion should be skipped, given a stored preference. Pure except for the OS query under "system". */
export function resolveReduceMotion(preference: MotionPreference): boolean {
  if (preference === "on") return true;
  if (preference === "off") return false;
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/* The answer the app resolved and stamped on the document (`data-motion`, set by the app's theme hook). The library
 * reads the stamp and never the store, so a component needs no app state: the app stamps, every component reads. */
const STAMP = "data-motion";

/** For non-React callers (a tween started from an event handler): the current stamp. */
export function reduceMotionNow(): boolean {
  return typeof document !== "undefined" && document.documentElement.getAttribute(STAMP) === "reduce";
}

function subscribe(onChange: () => void): () => void {
  if (typeof MutationObserver === "undefined") return () => undefined;
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: [STAMP] });
  return () => observer.disconnect();
}

/** For components; re-renders when the app restamps the document. Server renders (tests) answer "not reduced". */
export function useReduceMotion(): boolean {
  return useSyncExternalStore(subscribe, reduceMotionNow, () => false);
}
