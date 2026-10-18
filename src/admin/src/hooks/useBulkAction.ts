import { useCallback, useMemo, useState } from "react";
import { createBulkRunner, type BulkSpec } from "@/services/bulk-run";
import { useAppStore } from "@/store/app-store";

export interface BulkAction {
  /** Runs the spec's plan; what it could not do goes to the Events drawer and the notice line, never into the page. */
  readonly run: <Id>(spec: BulkSpec<Id>) => Promise<void>;
  readonly running: boolean;
}

/** THE SHARED BULK HOOK (owner, 2026-10-17): any tab that ticks rows runs its bulk verbs through it. The plan (which rows
 *  run, which are refused and why) is `lib/bulk-plan.ts`, the runner is `services/bulk-run.ts`; this only holds whether a
 *  run is going. The statusbar's working count, the per-record warnings and the summary sentence are the runner's. */
export function useBulkAction(): BulkAction {
  const runner = useMemo(() => createBulkRunner(() => useAppStore.getState()), []);
  const [running, setRunning] = useState(false);

  const run = useCallback(
    async <Id>(spec: BulkSpec<Id>): Promise<void> => {
      setRunning(true);
      try {
        await runner.run(spec);
      } finally {
        setRunning(false);
      }
    },
    [runner],
  );
  return { run, running };
}
