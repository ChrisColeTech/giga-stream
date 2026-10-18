import { useEffect } from "react";
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
        const sentence = error instanceof Error ? error.message : "Could not reach the fileserver.";
        useAppStore.getState().say(sentence, "warn");
        revealSettled();
      });
    return () => {
      controller.abort();
      window.clearTimeout(fallback);
    };
  }, []);
}
