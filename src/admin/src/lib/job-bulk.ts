import { ALREADY_DISABLED, ALREADY_ENABLED, UNREACHABLE_REASON } from "@/constants/account-copy";
import { DELETE_RUNNING, EVERY_JOB_DISABLED, EVERY_JOB_ENABLED, WORKING_REASON } from "@/constants/job-copy";
import { TICK_JOB_FIRST } from "@/constants/record-copy";
import type { AdminJob } from "@/services/schemas/job-schema";
import type { AdminPlaylist } from "@/services/schemas/playlist-schema";
import { planBulk, type BulkPlan, type BulkWords } from "./bulk-plan";
import { runGate } from "./job-run-gate";
import { tickedOf } from "./playlist-rows";

/* The Jobs toolbar's verbs on the ticked jobs (`38` section 4.2), pure. `Run job` is a bulk verb too:
 * the shared runner takes the ticked jobs one after another. It is all or nothing: the gate refuses the press when any
 * ticked job cannot run. Enable and Disable skip a job already so; Delete skips a running job. */

export type JobBulkVerb = "run" | "enable" | "disable" | "delete";

/** The selection toolbar's order (`01` section 9): `Run job` first, as Playlists' `Sync now`, then Enable and Disable,
 *  and the armed `Delete` last (LoRA Trainer `GalleryToolbar.tsx`: the destructive verb ends the cluster). */
export const JOB_BULK_ORDER: readonly JobBulkVerb[] = ["run", "enable", "disable", "delete"];

const words = (past: string): BulkWords => ({ past, noun: "job", nouns: "jobs" });

export const JOB_BULK_WORDS: Readonly<Record<JobBulkVerb, BulkWords>> = {
  run: words("Ran"),
  enable: words("Enabled"),
  disable: words("Disabled"),
  delete: words("Deleted"),
};

function skip(verb: JobBulkVerb, job: AdminJob): string | null {
  if (verb === "enable") return job.enabled ? ALREADY_ENABLED : null;
  if (verb === "disable") return job.enabled ? null : ALREADY_DISABLED;
  if (verb === "delete") return job.running ? DELETE_RUNNING : null;
  return null;
}

export function planJobBulk(
  verb: JobBulkVerb,
  items: readonly AdminJob[],
  ticked: readonly number[],
): BulkPlan<number> {
  const rows = tickedOf(items, ticked);
  return planBulk(
    rows.map((row) => ({ id: row.id, label: row.name })),
    (item) => {
      const job = rows.find((row) => row.id === item.id);
      return job === undefined ? null : skip(verb, job);
    },
  );
}

/** Why a verb is disabled, or undefined. `Run job` gives the gate's reasons in their order; the others say `Tick a job
 *  first`, `Working.` while a run goes, the unreachable sentence, then why nothing is left to run. */
export function jobVerbReason(
  verb: JobBulkVerb,
  plan: BulkPlan<number>,
  context: {
    readonly items: readonly AdminJob[];
    readonly ticked: readonly number[];
    readonly playlists: readonly AdminPlaylist[];
    readonly busy: boolean;
    readonly unreachable: boolean;
  },
): string | undefined {
  if (context.ticked.length === 0) return TICK_JOB_FIRST;
  if (verb === "run") {
    const gate = runGate(tickedOf(context.items, context.ticked), context.playlists, context.unreachable);
    return gate ?? (context.busy ? WORKING_REASON : undefined);
  }
  if (context.busy) return WORKING_REASON;
  if (context.unreachable) return UNREACHABLE_REASON;
  if (plan.runnable.length > 0) return undefined;
  if (verb === "enable") return EVERY_JOB_ENABLED;
  if (verb === "disable") return EVERY_JOB_DISABLED;
  return plan.refused[0]?.reason;
}
