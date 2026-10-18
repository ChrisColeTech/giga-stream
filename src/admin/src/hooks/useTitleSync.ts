import type { StripVerb } from "@giga/ui/lists/TableStrip";
import { NO_CATALOG_JOB, SYNC_NOW, SYNC_WORDS, syncPlan, syncReason } from "@/lib/title-sync";
import { sentenceOf } from "@/services/provider-flow-support";
import { jobs } from "@/services/jobs";
import { useAppStore } from "@/store/app-store";
import { useBulkAction } from "./useBulkAction";
import { useTitleFlows } from "./useTitleFlows";

/** `Sync now` (`docs/41` section 5.3): a word in the table strip that runs every enabled catalog job through the shared
 *  bulk runner (`N syncing` in the statusbar, one summary on the notice line) and reads the list again once the runs
 *  answer. Disabled with its reason; the Jobs tab's list is read at the press when that tab has not read it yet. */
export function useTitleSync(): StripVerb {
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
    if (plan.runnable.length === 0) return now.say(NO_CATALOG_JOB, "warn", "Job");
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
  const reason = syncReason({ jobs: known, syncing, busy: bulk.running, unreachable });
  return { id: "sync-now", label: SYNC_NOW, onPress: () => void press(), reason };
}
