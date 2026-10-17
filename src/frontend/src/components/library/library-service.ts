import { useAppStore } from "@/store/app-store";
import type { ServiceResult } from "@/services/not-connected";
import { playItem } from "@/services/library";
import type { ItemRef } from "@/types/library";

/** A refusal from the fileserver is said once on the notice line, and the caller changes nothing. Returns whether the call
 *  succeeded, so a local mark only moves on success. */
export function reportRefusal(result: ServiceResult): boolean {
  if (result.ok) return true;
  useAppStore.getState().say(result.message, "warn");
  return false;
}

/** Starts a title or a local file in the Player. The Player owns what happens next. */
export function playRef(ref: ItemRef): void {
  reportRefusal(playItem(ref));
}
