import { LAST_DISABLE, SAVING_REASON, UNREACHABLE_REASON } from "@/constants/account-copy";
import { LAST_ACCOUNT } from "@/constants/record-copy";
import type { AdminAccount } from "@/types/admin-account";
import { sameId } from "./account-rows";

/* The last enabled account can be neither deleted nor disabled (the backend answers `409 account.last_admin`; `29` section
 * 9.6). The page knows it from the list it holds and disables those two controls up front, with the reason. The server
 * still decides: a stale list can be wrong, and then the refusal arrives as the sentence. Pure. */

export const enabledCount = (items: readonly AdminAccount[]): number => items.filter((item) => !item.disabled).length;

/** True when this account is enabled and no other account is. */
export function isLastEnabled(items: readonly AdminAccount[], account: AdminAccount): boolean {
  const others = items.filter((item) => !sameId(item.id, account.id));
  return !account.disabled && enabledCount(others) === 0;
}

/** Why an account's Delete is disabled, or undefined. A disabled account is always deletable. */
export function deleteReason(
  items: readonly AdminAccount[],
  account: AdminAccount,
  state: { readonly unreachable: boolean; readonly busy: boolean },
): string | undefined {
  if (isLastEnabled(items, account)) return LAST_ACCOUNT;
  if (state.unreachable) return UNREACHABLE_REASON;
  return state.busy ? SAVING_REASON : undefined;
}

/** Why the Enabled switch cannot be turned off, or undefined. Turning an account ON is never refused. */
export function disableReason(items: readonly AdminAccount[], account: AdminAccount): string | undefined {
  return isLastEnabled(items, account) ? LAST_DISABLE : undefined;
}
