import { TICK_FIRST } from "@/constants/record-copy";
import {
  RESTORE_RETURN_MANY,
  RESTORE_RETURN_ONE,
  SAVING_REASON,
  UNREACHABLE_REASON,
} from "@/constants/title-copy";
import type { AdminDeletedTitle } from "@/services/schemas/title-schema";
import { planBulk, type BulkItem, type BulkPlan, type BulkWords } from "./bulk-plan";
import { formatWhen } from "./format-when";

/* The Deleted titles group as pure data (`37` section 4.4): the name a row shows, the ticks and the select-all state,
 * and the bulk Restore's plan and words over the shared bulk piece. A restore skips nothing: every ticked row runs.
 * No React, no store. */

/** The title text kept at delete time, or the id when none was kept (`movie-603`). */
export const deletedName = (item: AdminDeletedTitle): string => item.title ?? item.id;

export interface DeletedRowView {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly when: string;
}

export const deletedRow = (item: AdminDeletedTitle): DeletedRowView => ({
  id: item.id,
  name: deletedName(item),
  kind: item.kind === "movie" ? "Movie" : "Series",
  when: formatWhen(item.deletedAt),
});

export const withoutDeleted = (items: readonly AdminDeletedTitle[], ids: readonly string[]): AdminDeletedTitle[] =>
  items.filter((item) => !ids.includes(item.id));

export const pruneDeletedTicks = (ticked: readonly string[], items: readonly AdminDeletedTitle[]): string[] =>
  ticked.filter((id) => items.some((item) => item.id === id));

export function deletedSelectAll(items: readonly AdminDeletedTitle[], ticked: readonly string[]): boolean | "mixed" {
  const count = items.filter((item) => ticked.includes(item.id)).length;
  if (count === 0) return false;
  return count === items.length ? true : "mixed";
}

export function planRestore(items: readonly AdminDeletedTitle[], ticked: readonly string[]): BulkPlan<string> {
  const chosen: BulkItem<string>[] = items
    .filter((item) => ticked.includes(item.id))
    .map((item) => ({ id: item.id, label: deletedName(item) }));
  return planBulk(chosen, () => null);
}

/** The summary reads `Restored 3 titles; they return on the next browse or sync.` */
export const RESTORE_WORDS: BulkWords = {
  past: "Restored",
  noun: `title; ${RESTORE_RETURN_ONE}`,
  nouns: `titles; ${RESTORE_RETURN_MANY}`,
};

/** Why Restore is disabled, or undefined: nothing ticked, a run or a write going, the backend unreachable. */
export function restoreReason(
  tickedCount: number,
  state: { readonly busy: boolean; readonly unreachable: boolean },
): string | undefined {
  if (tickedCount === 0) return TICK_FIRST;
  if (state.busy) return SAVING_REASON;
  return state.unreachable ? UNREACHABLE_REASON : undefined;
}
