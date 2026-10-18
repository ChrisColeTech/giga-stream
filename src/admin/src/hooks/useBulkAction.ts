import { useCallback, useMemo, useState } from "react";
import { bulkNotes, type BulkNote } from "@/lib/bulk-plan";
import { createBulkRunner, type BulkSpec } from "@/services/bulk-run";
import { useAppStore } from "@/store/app-store";

export interface BulkAction {
  /** Runs the spec's plan; the notes below are what it leaves listed under the toolbar. */
  readonly run: <Id>(spec: BulkSpec<Id>) => Promise<void>;
  readonly running: boolean;
  /** Every failure and every skip of the last run, each with its sentence. Empty before a run and after `dismiss`. */
  readonly notes: readonly BulkNote[];
  readonly dismiss: () => void;
}

/** THE SHARED BULK HOOK (owner, 2026-10-17): any tab that ticks rows runs its bulk verbs through it. The plan (which rows
 *  run, which are refused and why) is `lib/bulk-plan.ts`, the runner is `services/bulk-run.ts`; this only holds what the
 *  toolbar draws: whether a run is going and the list of notes it left. The statusbar's working count and the summary
 *  sentence are the runner's. */
export function useBulkAction(): BulkAction {
  const runner = useMemo(() => createBulkRunner(() => useAppStore.getState()), []);
  const [running, setRunning] = useState(false);
  const [notes, setNotes] = useState<readonly BulkNote[]>([]);

  const run = useCallback(
    async <Id>(spec: BulkSpec<Id>): Promise<void> => {
      setNotes([]);
      setRunning(true);
      try {
        const outcome = await runner.run(spec);
        if (outcome !== null) setNotes(bulkNotes(outcome));
      } finally {
        setRunning(false);
      }
    },
    [runner],
  );
  return { run, running, notes, dismiss: useCallback(() => setNotes([]), []) };
}
