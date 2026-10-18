import type { EventTone } from "@giga/ui/lib/event-log";

/* BULK ACTIONS, shared by every tab that ticks rows (owner, 2026-10-17). A plan splits the ticked rows into the ones that
 * can run and the ones refused with their reason; the runner calls one single-record service call per runnable row,
 * strictly in order, and one failure never stops the rest. The tab supplies its own rules and its own `perform`; nothing
 * here knows what a record is. Pure of React, the store and the services. */

export interface BulkItem<Id> {
  readonly id: Id;
  /** What the person calls the record in a list and a sentence (`ed@example.test`). */
  readonly label: string;
}

export interface BulkRefused<Id> extends BulkItem<Id> {
  readonly reason: string;
}

export interface BulkFailure<Id> extends BulkItem<Id> {
  readonly sentence: string;
}

export interface BulkPlan<Id> {
  readonly runnable: readonly BulkItem<Id>[];
  readonly refused: readonly BulkRefused<Id>[];
}

export interface BulkOutcome<Id> {
  readonly done: readonly BulkItem<Id>[];
  readonly failed: readonly BulkFailure<Id>[];
  readonly refused: readonly BulkRefused<Id>[];
}

/** Splits the ticked items, in order. `decide` answers the refusal sentence for an item or null to run it; it is called
 *  once per item in order, so a rule that depends on the items before it (the last enabled account) can keep a count. */
export function planBulk<Id>(items: readonly BulkItem<Id>[], decide: (item: BulkItem<Id>) => string | null): BulkPlan<Id> {
  const runnable: BulkItem<Id>[] = [];
  const refused: BulkRefused<Id>[] = [];
  for (const item of items) {
    const reason = decide(item);
    if (reason === null) runnable.push(item);
    else refused.push({ ...item, reason });
  }
  return { runnable, refused };
}

export const FALLBACK_FAILURE = "The request failed.";

/** Runs the plan's runnable items one after the other. `perform` answers null on success or the failure's sentence; one
 *  that throws is a failure too. `stop` is asked before each item (the session ended): the rest are left unrun. */
export async function runBulk<Id>(
  plan: BulkPlan<Id>,
  perform: (item: BulkItem<Id>) => Promise<string | null>,
  stop: () => boolean = () => false,
): Promise<BulkOutcome<Id>> {
  const done: BulkItem<Id>[] = [];
  const failed: BulkFailure<Id>[] = [];
  for (const item of plan.runnable) {
    if (stop()) break;
    const sentence = await perform(item).catch((): string => FALLBACK_FAILURE);
    if (sentence === null) done.push(item);
    else failed.push({ ...item, sentence });
  }
  return { done, failed, refused: plan.refused };
}

export interface BulkWords {
  /** `Disabled` */
  readonly past: string;
  readonly noun: string;
  readonly nouns: string;
}

/** The one sentence for the notice line: `Disabled 2 accounts; 1 failed; 1 skipped.` A warning when anything failed or was
 *  skipped with nothing done. */
export function bulkSummary<Id>(words: BulkWords, outcome: BulkOutcome<Id>): { sentence: string; tone: EventTone } {
  const count = outcome.done.length;
  const parts = [`${words.past} ${count} ${count === 1 ? words.noun : words.nouns}`];
  if (outcome.failed.length > 0) parts.push(`${outcome.failed.length} failed`);
  if (outcome.refused.length > 0) parts.push(`${outcome.refused.length} skipped`);
  const trouble = outcome.failed.length > 0 || (count === 0 && outcome.refused.length > 0);
  return { sentence: `${parts.join("; ")}.`, tone: trouble ? "warn" : "info" };
}

/** What stays listed under the toolbar after a run: every failure and every skip, with its sentence. */
export interface BulkNote {
  readonly id: string;
  readonly label: string;
  readonly sentence: string;
}

export function bulkNotes<Id>(outcome: BulkOutcome<Id>): BulkNote[] {
  return [
    ...outcome.failed.map((item) => ({ id: String(item.id), label: item.label, sentence: item.sentence })),
    ...outcome.refused.map((item) => ({ id: String(item.id), label: item.label, sentence: item.reason })),
  ];
}
