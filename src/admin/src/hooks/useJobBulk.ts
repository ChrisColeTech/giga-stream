import type { ToolbarVerb } from "@giga/ui/shell/ToolbarStrip";
import { BULK_DELETE, BULK_DISABLE, BULK_ENABLE } from "@/constants/account-copy";
import { RUN_JOB } from "@/constants/job-copy";
import type { BulkNote } from "@/lib/bulk-plan";
import { JOB_BULK_ORDER, JOB_BULK_WORDS, jobVerbReason, planJobBulk, type JobBulkVerb } from "@/lib/job-bulk";
import { useAppStore } from "@/store/app-store";
import { useBulkAction } from "./useBulkAction";
import { useJobActions } from "./useJobActions";

export interface JobBulk {
  /** The strip's verbs, in order: the ghost Enable, Disable and armed Delete, then the filled `Run job`. */
  readonly verbs: readonly ToolbarVerb[];
  readonly notes: readonly BulkNote[];
  readonly dismiss: () => void;
}

const LABELS: Readonly<Record<JobBulkVerb, string>> = {
  run: RUN_JOB,
  enable: BULK_ENABLE,
  disable: BULK_DISABLE,
  delete: BULK_DELETE,
};

/** The Jobs toolbar (`38` section 4.2). `Run job` is a bulk verb: the ticked jobs run one after another through the
 *  shared runner (one playlist sync at a time on the backend), a refusal on one is reported and the rest continue.
 *  Every verb is always drawn and disabled with its reason (`Tick a job first`, the gate's reasons for `Run job`).
 *  A run that synced playlists marks the Playlists and Channels tabs stale; any job write marks Playlists stale. */
export function useJobBulk(): JobBulk {
  const { flows } = useJobActions();
  const bulk = useBulkAction();
  const items = useAppStore((state) => state.jobs.items);
  const ticked = useAppStore((state) => state.jobs.ticked);
  const playlists = useAppStore((state) => state.jobs.playlists);
  const unreachable = useAppStore((state) => state.jobs.unreachable);
  const verbs = JOB_BULK_ORDER.map((verb): ToolbarVerb => {
    const plan = planJobBulk(verb, items, ticked);
    const count = plan.runnable.length;
    const press = (): void => {
      void bulk.run({
        words: JOB_BULK_WORDS[verb],
        area: "Job",
        plan,
        perform: flows.bulkCall(verb),
        finish: (outcome) => {
          const now = useAppStore.getState();
          now.jobsSetTicked(now.jobs.ticked.filter((id) => !outcome.done.some((item) => item.id === id)));
          if (outcome.done.length === 0) return;
          now.markStale("playlists");
          if (verb === "run") now.markStale("channels");
        },
        reread: flows.refresh,
      });
    };
    return {
      id: verb,
      label: LABELS[verb],
      tone: verb === "run" ? "filled" : "ghost",
      reason: jobVerbReason(verb, plan, { items, ticked, playlists, busy: bulk.running, unreachable }),
      onPress: press,
      ...(verb === "delete" && { question: `Delete ${count} ${count === 1 ? "job" : "jobs"}?` }),
    };
  });
  return { verbs, notes: bulk.notes, dismiss: bulk.dismiss };
}
