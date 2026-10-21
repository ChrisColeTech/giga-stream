import { useState } from "react";
import { clearWatch } from "@/services/watch";
import { useAppStore } from "@/store/app-store";

export interface ClearHistoryAction {
  readonly clearing: boolean;
  readonly clear: () => void;
}

/** Owns Settings' clear-history request and projects its consequence into the store. */
export function useClearHistory(): ClearHistoryAction {
  const [clearing, setClearing] = useState(false);
  const clear = (): void => {
    if (clearing) return;
    setClearing(true);
    void clearWatch().then(() => {
      useAppStore.getState().forgetAllWatch();
      useAppStore.getState().requestLibraryRefresh();
      useAppStore.getState().say("History cleared.");
    }).catch((error: unknown) => {
      useAppStore.getState().say(
        error instanceof Error ? error.message : "Could not reach the fileserver.",
        "warn",
      );
    }).finally(() => setClearing(false));
  };
  return { clearing, clear };
}
