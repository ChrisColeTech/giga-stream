import type { ScanTerminal } from "@/services/scan-stream";
import type { ScanProgress } from "@/types/collection";

export interface ScanObserverDeps {
  readonly stream: (
    folderId: string,
    onProgress: (progress: ScanProgress) => void,
    signal: AbortSignal,
  ) => Promise<ScanTerminal>;
  readonly refresh: () => Promise<void>;
  readonly setProgress: (folderId: string, progress: ScanProgress) => void;
  readonly isMissing: (error: unknown) => boolean;
  readonly done: (terminal: ScanTerminal) => void;
  readonly warn: (error: unknown) => void;
}

export interface ScanObserver {
  readonly sync: (folderIds: readonly string[]) => void;
  readonly close: () => void;
}

export function createScanObserver(deps: ScanObserverDeps): ScanObserver {
  const active = new Map<string, AbortController>();

  const observe = (folderId: string): void => {
    const controller = new AbortController();
    active.set(folderId, controller);
    void deps
      .stream(folderId, (progress) => deps.setProgress(folderId, progress), controller.signal)
      .then(async (terminal) => {
        try {
          await deps.refresh();
          deps.done(terminal);
        } catch (error: unknown) {
          deps.warn(error);
        }
      })
      .catch(async (error: unknown) => {
        if (controller.signal.aborted) return;
        try {
          await deps.refresh();
          if (!deps.isMissing(error)) deps.warn(error);
        } catch (refreshError: unknown) {
          deps.warn(refreshError);
        }
      })
      .finally(() => {
        if (active.get(folderId) === controller) active.delete(folderId);
      });
  };

  return {
    sync(folderIds) {
      for (const folderId of folderIds) {
        if (!active.has(folderId)) observe(folderId);
      }
    },
    close() {
      for (const controller of active.values()) controller.abort();
      active.clear();
    },
  };
}
