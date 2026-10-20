import { useEffect } from "react";
import { onDesktopRuntime } from "@/services/persistence";
import { readState } from "@/services/state";
import { useAppStore } from "@/store/app-store";

const FALLBACK_MS = 1500;

export function useAppHydration(): void {
  useEffect(() => {
    const controller = new AbortController();
    const fallback = window.setTimeout(() => useAppStore.getState().revealShell(), FALLBACK_MS);
    const revealSettled = (): void => {
      requestAnimationFrame(() => requestAnimationFrame(() => useAppStore.getState().revealShell()));
    };
    void readState(controller.signal)
      .then((snapshot) => {
        const store = useAppStore.getState();
        store.applySnapshot(snapshot);
        if (snapshot.unreadable.length > 0) {
          store.say(`Some saved state could not be read: ${snapshot.unreadable.join(", ")}.`, "warn");
        }
        revealSettled();
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const store = useAppStore.getState();
        store.say(error instanceof Error ? error.message : "Could not reach the fileserver.", "warn");
        // `61` section 2.4: in a browser a down fileserver must not block layout and theme, so the local parts are
        // applied even from the failure path; the desktop keeps today's server-only behaviour.
        if (!onDesktopRuntime()) store.applySnapshot({ unreadable: [] });
        revealSettled();
      });
    return () => {
      controller.abort();
      window.clearTimeout(fallback);
    };
  }, []);
}
