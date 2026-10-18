import {
  ALREADY_DISABLED,
  ALREADY_ENABLED,
  MANUAL_NO_TMDB,
  NOTHING_EDITED,
  SAVING_REASON,
  SYNCED_RETURN,
  UNREACHABLE_REASON,
} from "@/constants/title-copy";
import { TICK_FIRST } from "@/constants/record-copy";
import type { AdminTitleRow } from "@/services/schemas/title-schema";
import { planBulk, type BulkItem, type BulkPlan, type BulkWords } from "./bulk-plan";
import { isEnabledTitle, isManualTitle } from "./title-rows";

/* The Titles toolbar's bulk verbs (`37` section 4.2, `39` section 6), pure. Enable and Disable skip a title already in
 * that state; Revert to TMDB skips a title made by hand and an unedited synced one; Delete runs on manual AND synced
 * titles alike (owner, 2026-10-17), and its summary says that a deleted synced title comes back. */

export type TitleBulkVerb = "enable" | "disable" | "revert" | "delete";

export const TITLE_BULK_ORDER: readonly TitleBulkVerb[] = ["enable", "disable", "revert", "delete"];

export const TITLE_BULK_LABELS: Readonly<Record<TitleBulkVerb, string>> = {
  enable: "Enable",
  disable: "Disable",
  revert: "Revert to TMDB",
  delete: "Delete",
};

const WORDS: Readonly<Record<TitleBulkVerb, BulkWords>> = {
  enable: { past: "Enabled", noun: "title", nouns: "titles" },
  disable: { past: "Disabled", noun: "title", nouns: "titles" },
  revert: { past: "Reverted", noun: "title", nouns: "titles" },
  delete: { past: "Deleted", noun: "title", nouns: "titles" },
};

export const tickedTitles = (items: readonly AdminTitleRow[], ticked: readonly string[]): BulkItem<string>[] =>
  items.filter((item) => ticked.includes(item.id)).map((item) => ({ id: item.id, label: item.title }));

/** Why one ticked title is skipped by a verb, or null to run it. */
export function titleSkip(verb: TitleBulkVerb, title: AdminTitleRow): string | null {
  if (verb === "enable") return isEnabledTitle(title) ? ALREADY_ENABLED : null;
  if (verb === "disable") return isEnabledTitle(title) ? null : ALREADY_DISABLED;
  if (verb !== "revert") return null;
  return isManualTitle(title) ? MANUAL_NO_TMDB : title.state === "synced" ? NOTHING_EDITED : null;
}

export function planTitleBulk(
  verb: TitleBulkVerb,
  items: readonly AdminTitleRow[],
  ticked: readonly string[],
): BulkPlan<string> {
  return planBulk(tickedTitles(items, ticked), (item) => {
    const title = items.find((one) => one.id === item.id);
    return title === undefined ? null : titleSkip(verb, title);
  });
}

/** Why a verb is disabled, or undefined: nothing ticked, a run or a write going, the backend unreachable, or nothing
 *  left to run (then the first skipped row's own reason). */
export function titleBulkReason(
  plan: BulkPlan<string>,
  tickedCount: number,
  state: { readonly busy: boolean; readonly unreachable: boolean },
): string | undefined {
  if (tickedCount === 0) return TICK_FIRST;
  if (state.busy) return SAVING_REASON;
  if (state.unreachable) return UNREACHABLE_REASON;
  return plan.runnable.length > 0 ? undefined : plan.refused[0]?.reason;
}

/** How many of a plan's runnable rows are synced titles (a deleted one comes back on the next sync or browse). */
export const syncedCount = (plan: BulkPlan<string>, items: readonly AdminTitleRow[]): number =>
  plan.runnable.filter((item) => items.some((one) => one.id === item.id && !isManualTitle(one))).length;

const SYNCED_ONE = SYNCED_RETURN.replace("come back", "comes back").replace("lists them", "lists it");

/** The summary's words. For Delete with synced titles in the plan the noun carries the consequence, so the shared
 *  summary reads `Deleted 5 titles; 3 were synced and come back on the next catalog sync or browse that lists them.
 *  Disable a title to keep it hidden.` (`37` section 4.2). */
export function titleBulkWords(verb: TitleBulkVerb, synced: number): BulkWords {
  const words = WORDS[verb];
  if (verb !== "delete" || synced === 0) return words;
  const clause = `; ${synced} ${synced === 1 ? "was" : "were"} synced and ${synced === 1 ? SYNCED_ONE : SYNCED_RETURN}`;
  return { ...words, noun: `${words.noun}${clause}`, nouns: `${words.nouns}${clause}` };
}

export const titleDeleteQuestion = (count: number): string => `Delete ${count} ${count === 1 ? "title" : "titles"}?`;
