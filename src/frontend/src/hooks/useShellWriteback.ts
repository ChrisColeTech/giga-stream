import { useEffect } from "react";
import { patchShellState } from "@/services/shell-state";
import { useAppStore } from "@/store/app-store";

const WRITE_DELAY_MS = 400;

export function useShellWriteback(): void {
  const enabled = useAppStore((state) => state.shellWriteEnabled);
  const revision = useAppStore((state) => state.shellRevision);
  const saved = useAppStore((state) => state.savedShellRevision);
  const surface = useAppStore((state) => state.surface);
  const open = useAppStore((state) => state.open);
  const sizes = useAppStore((state) => state.sizes);

  useEffect(() => {
    if (!enabled || revision <= saved) return;
    const timer = window.setTimeout(() => {
      void patchShellState({ surface, open, sizes })
        .then(() => useAppStore.getState().markShellSaved(revision))
        .catch((error: unknown) => {
          const sentence = error instanceof Error ? error.message : "The layout was not saved.";
          useAppStore.getState().say(sentence, "warn");
        });
    }, WRITE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [enabled, open, revision, saved, sizes, surface]);
}
