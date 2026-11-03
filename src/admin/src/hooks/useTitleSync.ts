import type { StripVerb } from "@giga/ui/lists/TableStrip";
import { NO_CATALOG_JOB, SYNC_NOW, SYNC_WORDS, syncPlan, syncReason } from "@/lib/title-sync";
import { sentenceOf } from "@/services/provider-flow-support";
import { jobs } from "@/services/jobs";
import { useAppStore } from "@/store/app-store";
import { useBulkAction } from "./useBulkAction";
import { useTitleFlows } from "./useTitleFlows";
import { useJobsLoad } from "./useJobsLoad";

/** `Sync now` (`docs/41` section 5.3): a word in the table strip that runs every enabled catalog job through the shared
 *  bulk runner (`N syncing` in the statusbar, one summary on the notice line) and reads the list again once the runs
 *  answer. Reads the jobs on mount so execution policy disables the control before a press. */
export function useTitleSync(): StripVerb {
  useJobsLoad(true);
  const flows = useTitleFlows();
  const bulk = useBulkAction();
  const read = useAppStore((state) => state.jobs);
  const syncing = useAppStore((state) => state.work.syncing);
  const unreachable = useAppStore((state) => state.titlesStored.unreachable);
  const known = read.status === "ready" ? read.items : null;

  const press = async (): Promise<void> => {
    const now = useAppStore.getState();
    const all = known ?? (await jobs.list().then((list) => list.items, () => null));
    if (all === null) return now.say(sentenceOf(null), "warn", "Job");
    const plan = syncPlan(all);
    if (plan.runnable.length === 0) return now.say(plan.refused[0]?.reason ?? NO_CATALOG_JOB, "warn", "Job");
    await bulk.run({
      words: SYNC_WORDS,
      area: "Job",
      plan,
      perform: (item) => jobs.run(item.id).then(() => null, (error: unknown) => sentenceOf(error)),
      finish: (outcome) => {
        if (outcome.done.length > 0) useAppStore.getState().markStale("jobs");
      },
      reread: flows.refresh,
    });
  };
  const reason = syncReason({ jobs: known, syncing, busy: bulk.running, unreachable: unreachable || read.unreachable });
  return { id: "sync-now", label: SYNC_NOW, tip: "Sync the titles from the catalog now", onPress: () => void press(), reason };
}
