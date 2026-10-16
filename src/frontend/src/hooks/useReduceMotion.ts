import { REDUCED_MOTION_QUERY } from "@/constants/timing";
import { useAppStore } from "@/store/app-store";
import type { MotionPreference } from "@/types/shell";

/** Whether motion should be skipped, given a stored preference. */
export function resolveReduceMotion(preference: MotionPreference): boolean {
  if (preference === "on") return true;
  if (preference === "off") return false;
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/** For non-React callers: reads the live store. */
export function reduceMotion(): boolean {
  return resolveReduceMotion(useAppStore.getState().motion);
}

/** For components; re-renders when the setting changes. */
export function useReduceMotion(): boolean {
  const preference = useAppStore((state) => state.motion);
  return resolveReduceMotion(preference);
}
