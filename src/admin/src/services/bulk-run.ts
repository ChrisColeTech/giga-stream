import {
  bulkNotes,
  bulkSummary,
  runBulk,
  type BulkItem,
  type BulkOutcome,
  type BulkPlan,
  type BulkWords,
} from "@/lib/bulk-plan";
import type { AppState } from "@/store/app-store";
import type { EventArea } from "@/types/events";

/** The part of the store a bulk run touches: the session's serial, the notice line and the statusbar's work count. */
export type BulkStore = Pick<AppState, "serial" | "signedIn" | "say" | "logEvent" | "work" | "setWork">;

export interface BulkSpec<Id> {
  readonly words: BulkWords;
  readonly area: EventArea;
  readonly plan: BulkPlan<Id>;
  /** One single-record call: null on success, the failure's sentence otherwise. */
  readonly perform: (item: BulkItem<Id>) => Promise<string | null>;
  /** Runs once the items are done and before the summary: the tab unticks what finished (failed rows stay ticked). */
  readonly finish: (outcome: BulkOutcome<Id>) => void;
  /** Reads the list again, once, at the end. */
  readonly reread: () => Promise<unknown>;
}

export interface BulkRunner {
  /** Null when the session ended under the run (nothing is said). */
  run: <Id>(spec: BulkSpec<Id>) => Promise<BulkOutcome<Id> | null>;
}

/** The shared runner of every tab's bulk verbs (owner, 2026-10-17): the runnable rows go one after the other, a failure
 *  never stops the rest, the statusbar counts the run as working while it goes, each failed or skipped record is a warning
 *  row of the Events drawer, ONE summary sentence goes on the notice line and the list is read once at the end. A run whose session ended stops at the next row and says nothing. */
export function createBulkRunner(store: () => BulkStore): BulkRunner {
  const work = (delta: number): void => store().setWork({ syncing: Math.max(0, store().work.syncing + delta) });
  async function run<Id>(spec: BulkSpec<Id>): Promise<BulkOutcome<Id> | null> {
    const serial = store().serial;
    const alive = (): boolean => store().signedIn && store().serial === serial;
    const running = spec.plan.runnable.length > 0;
    if (running) work(1);
    let outcome: BulkOutcome<Id>;
    try {
      outcome = await runBulk(spec.plan, spec.perform, () => !alive());
    } finally {
      if (running) work(-1);
    }
    if (!alive()) return null;
    spec.finish(outcome);
    /* Each record that failed or was skipped is a warning row of the Events drawer naming it and the sentence; the
       summary comes last, so the notice line ends on the run's one sentence. */
    for (const note of bulkNotes(outcome)) {
      store().logEvent({ tone: "warn", area: spec.area, identity: note.label, sentence: `${note.label}: ${note.sentence}` });
    }
    const summary = bulkSummary(spec.words, outcome);
    store().say(summary.sentence, summary.tone, spec.area);
    if (running) await spec.reread();
    return outcome;
  }
  return { run };
}
