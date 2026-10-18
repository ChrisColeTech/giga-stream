import type { StripVerb } from "@giga/ui/lists/TableStrip";
import { BULK_DELETE, BULK_DISABLE, BULK_ENABLE } from "@/constants/account-copy";
import { BULK_ICONS } from "@/constants/bulk-icons";
import { BULK_TIPS } from "@/constants/bulk-tips";
import { RUN_JOB, STOP_JOB } from "@/constants/job-copy";
import { JOB_BULK_ORDER, JOB_BULK_WORDS, jobVerbReason, planJobBulk, type JobBulkVerb } from "@/lib/job-bulk";
import { runningCount } from "@/lib/job-rows";
import { useAppStore } from "@/store/app-store";
import { useBulkAction } from "./useBulkAction";
import { useJobActions } from "./useJobActions";

export interface JobBulk {
  /** The table strip's verbs, in order: `Run job`, `Stop`, Enable, Disable, the armed Delete. */
  readonly verbs: readonly StripVerb[];
}

const LABELS: Readonly<Record<JobBulkVerb, string>> = {
  run: RUN_JOB,
  stop: STOP_JOB,
  enable: BULK_ENABLE,
  disable: BULK_DISABLE,
  delete: BULK_DELETE,
};

/** The Jobs table strip (`38` section 4.2). `Run job` is a bulk verb: the ticked jobs run one after another through the
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
  const verbs = JOB_BULK_ORDER.map((verb): StripVerb => {
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
          /* A run is started, not awaited: the runner's own count has gone back down, the started jobs are still going. */
          now.setWork({ syncing: runningCount(now.jobs.items) });
          if (outcome.done.length === 0 || verb === "stop") return;
          now.markStale("playlists");
          if (verb === "run") now.markStale("channels");
        },
        reread: flows.refresh,
      });
    };
    return {
      id: verb,
      label: LABELS[verb],
      icon: BULK_ICONS[verb],
      tip: BULK_TIPS[verb],
      reason: jobVerbReason(verb, plan, { items, ticked, playlists, busy: bulk.running, unreachable }),
      onPress: press,
      ...(verb === "delete" && { question: `Delete ${count} ${count === 1 ? "job" : "jobs"}?` }),
    };
  });
  return { verbs };
}
