import {
  ALREADY_DISABLED,
  ALREADY_ENABLED,
  LAST_DISABLE,
  OWN_DELETE_REFUSAL,
  OWN_DISABLE_REFUSAL,
  SAVING_REASON,
  TICK_ACCOUNT_FIRST,
  UNREACHABLE_REASON,
} from "@/constants/account-copy";
import { LAST_ACCOUNT } from "@/constants/record-copy";
import type { AccountId, AdminAccount } from "@/types/admin-account";
import { enabledCount } from "./account-guard";
import { findAccount, isTicked, sameId } from "./account-rows";
import { planBulk, type BulkItem, type BulkPlan, type BulkWords } from "./bulk-plan";

export type AccountBulkVerb = "enable" | "disable" | "delete";

export const BULK_WORDS: Readonly<Record<AccountBulkVerb, BulkWords>> = {
  enable: { past: "Enabled", noun: "account", nouns: "accounts" },
  disable: { past: "Disabled", noun: "account", nouns: "accounts" },
  delete: { past: "Deleted", noun: "account", nouns: "accounts" },
};

/** Why a bulk verb is disabled, or undefined: nothing ticked, a run going, the backend unreachable, or every ticked row
 *  refused (then the first refusal's own reason). A verb with at least one runnable row works; the rest are skipped, said
 *  in the run's summary and listed under the toolbar. */
export function bulkVerbReason(
  plan: BulkPlan<AccountId>,
  tickedCount: number,
  state: { readonly busy: boolean; readonly unreachable: boolean },
): string | undefined {
  if (tickedCount === 0) return TICK_ACCOUNT_FIRST;
  if (state.busy) return SAVING_REASON;
  if (state.unreachable) return UNREACHABLE_REASON;
  return plan.runnable.length > 0 ? undefined : plan.refused[0]?.reason;
}

/** The ticked accounts in list order, as the plan's items. */
export function tickedItems(items: readonly AdminAccount[], ticked: readonly AccountId[]): BulkItem<AccountId>[] {
  return items.filter((item) => isTicked(ticked, item.id)).map((item) => ({ id: item.id, label: item.email }));
}

/** Which ticked accounts a bulk verb can run on. The signed-in account is never disabled or deleted in bulk (the session
 *  would end under the run); an account already in the wanted state is skipped; and the last enabled account is kept: the
 *  enabled count is carried down the list, so the run never takes the final enabled account away. */
export function planAccountBulk(
  verb: AccountBulkVerb,
  items: readonly AdminAccount[],
  ticked: readonly AccountId[],
  ownId: AccountId | null,
): BulkPlan<AccountId> {
  let enabled = enabledCount(items);
  const guard = (account: AdminAccount, reason: string): string | null => {
    if (account.disabled) return null;
    if (enabled <= 1) return reason;
    enabled -= 1;
    return null;
  };
  return planBulk(tickedItems(items, ticked), (item) => {
    const account = findAccount(items, item.id);
    if (account === undefined) return null;
    const own = ownId !== null && sameId(ownId, account.id);
    if (verb === "enable") return account.disabled ? null : ALREADY_ENABLED;
    if (own) return verb === "disable" ? OWN_DISABLE_REFUSAL : OWN_DELETE_REFUSAL;
    if (verb === "disable") return account.disabled ? ALREADY_DISABLED : guard(account, LAST_DISABLE);
    return guard(account, LAST_ACCOUNT);
  });
}
