import { useEffect } from "react";
import { patchShellState, type ShellLayout } from "@/services/shell-state";
import { useAppStore, type AppState } from "@/store/app-store";

export const SHELL_WRITE_DELAY_MS = 400;

interface PendingShell {
  readonly revision: number;
  readonly layout: ShellLayout;
}

interface ShellWritebackDeps {
  readonly getState: () => AppState;
  readonly subscribe: (listener: (state: AppState) => void) => () => void;
  readonly write: (layout: ShellLayout) => Promise<ShellLayout>;
  readonly schedule: (task: () => void, delay: number) => number;
  readonly cancel: (id: number) => void;
}

/** Starts the timer-owning shell writer. Exported so fake clocks can prove its ordering without rendering React. */
export function startShellWriteback(deps: ShellWritebackDeps): () => void {
  let timer: number | null = null;
  let pending: PendingShell | null = null;
  let ready = false;
  let writing = false;
  let active = true;

  const flush = async (): Promise<void> => {
    if (!active || writing || !ready || pending === null) return;
    const write = pending;
    pending = null;
    ready = false;
    writing = true;
    try {
      await deps.write(write.layout);
      if (active) {
        deps.getState().markShellSaved(write.revision);
        deps.getState().say("Layout saved.");
      }
    } catch (error: unknown) {
      const sentence = error instanceof Error ? error.message : "The layout was not saved.";
      if (active) deps.getState().say(sentence, "warn");
    } finally {
      writing = false;
      if (ready) void flush();
    }
  };

  const queue = (state: AppState): void => {
    if (!state.shellWriteEnabled || state.shellRevision <= state.savedShellRevision) return;
    pending = {
      revision: state.shellRevision,
      layout: { surface: state.surface, open: state.open, sizes: state.sizes },
    };
    ready = false;
    if (timer !== null) deps.cancel(timer);
    timer = deps.schedule(() => {
      timer = null;
      ready = true;
      void flush();
    }, SHELL_WRITE_DELAY_MS);
  };

  const unsubscribe = deps.subscribe(queue);
  queue(deps.getState());
  return () => {
    active = false;
    unsubscribe();
    if (timer !== null) deps.cancel(timer);
  };
}

export function useShellWriteback(): void {
  useEffect(
    () =>
      startShellWriteback({
        getState: useAppStore.getState,
        subscribe: useAppStore.subscribe,
        write: patchShellState,
        schedule: window.setTimeout,
        cancel: window.clearTimeout,
      }),
    [],
  );
}
