import { TICK_FIRST } from "@/constants/record-copy";
import { ADDING_REASON, ADD_DELETED, ADD_STORED, OPEN_UNSTORED } from "@/constants/title-browse-copy";
import { UNREACHABLE_REASON } from "@/constants/title-copy";
import type { AdminTitleRow } from "@/services/schemas/title-schema";
import { planBulk, type BulkItem, type BulkPlan } from "./bulk-plan";
import { browseState, type RowState } from "./row-state";

/* Browse TMDB rows as pure data (`docs/47` sections 3.3 and 4): the state word, and the explicit `Add` (what it may run on
 * and why it is refused). The rows are TMDB's own: a row is stored only once an Add stored it. No React, no store. */

/** `stored`, `deleted`, or null for a TMDB title the store lacks. */
export const browseStateOf = (title: AdminTitleRow): RowState | null => browseState(title);

/** Why a Browse row cannot be added, or null: it is already stored, or the admin deleted it (restore it first). */
export function addSkip(title: AdminTitleRow): string | null {
  if (title.deleted === true) return ADD_DELETED;
  return title.stored === true ? ADD_STORED : null;
}

/** Why the row's own `Add` is disabled, or undefined. */
export function addReason(title: AdminTitleRow, state: { readonly busy: boolean; readonly unreachable: boolean }): string | undefined {
  return addSkip(title) ?? (state.busy ? ADDING_REASON : state.unreachable ? UNREACHABLE_REASON : undefined);
}

const labelled = (items: readonly AdminTitleRow[], ids: readonly string[]): BulkItem<string>[] =>
  items.filter((item) => ids.includes(item.id)).map((item) => ({ id: item.id, label: item.title }));

/** The ticked rows split into the ones that can be added and the ones refused with their reason. */
export function planTitleAdd(items: readonly AdminTitleRow[], ticked: readonly string[]): BulkPlan<string> {
  return planBulk(labelled(items, ticked), (item) => {
    const title = items.find((one) => one.id === item.id);
    return title === undefined ? null : addSkip(title);
  });
}

/** Why the selection's `Add` is disabled, or undefined: nothing ticked, an add running, the backend unreachable, or
 *  nothing left to add (then the first refused row's own reason). */
export function addBulkReason(
  plan: BulkPlan<string>,
  tickedCount: number,
  state: { readonly busy: boolean; readonly unreachable: boolean },
): string | undefined {
  if (tickedCount === 0) return TICK_FIRST;
  if (state.busy) return ADDING_REASON;
  if (state.unreachable) return UNREACHABLE_REASON;
  return plan.runnable.length > 0 ? undefined : plan.refused[0]?.reason;
}

/** Why `Open` does nothing on this row, or undefined when it opens: only a stored title has a detail to read (a read of
 *  any other id is `404`), so no detail call is ever made for a row that is not stored. */
export function openReason(title: AdminTitleRow): string | undefined {
  if (title.deleted === true) return ADD_DELETED;
  return title.stored === true ? undefined : OPEN_UNSTORED;
}
