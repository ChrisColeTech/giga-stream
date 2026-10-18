import type { AccountId, AdminAccount } from "@/types/admin-account";
import { enabledState, type RowState } from "./row-state";
import { formatWhen } from "./format-when";

/* The accounts list as pure data: the order the backend keeps (by lower-cased username), the row a list draws, the select-all
 * tick and the names the Events drawer needs. No React, no store. */

const key = (account: AdminAccount): string => account.username.toLowerCase();

const sameId = (a: AccountId, b: AccountId): boolean => String(a) === String(b);

/** The list in the backend's order: usernames compared case-insensitively. */
export function sortedByUsername(items: readonly AdminAccount[]): AdminAccount[] {
  return [...items].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
}

/** The answer of a write put into the list: replaces the account with that id, or adds it; kept in order. */
export function upsertAccount(items: readonly AdminAccount[], account: AdminAccount): AdminAccount[] {
  return sortedByUsername([...items.filter((item) => !sameId(item.id, account.id)), account]);
}

export function withoutAccount(items: readonly AdminAccount[], id: AccountId): AdminAccount[] {
  return items.filter((item) => !sameId(item.id, id));
}

/** Only the ticks that still name a row of the list: a row that goes takes its tick with it. */
export function pruneTicks(ticked: readonly AccountId[], items: readonly AdminAccount[]): AccountId[] {
  return ticked.filter((id) => items.some((item) => sameId(item.id, id)));
}

export const isTicked = (ticked: readonly AccountId[], id: AccountId): boolean => ticked.some((one) => sameId(one, id));

export const findAccount = (items: readonly AdminAccount[], id: AccountId): AdminAccount | undefined =>
  items.find((item) => sameId(item.id, id));

export { sameId };

/** The header's select-all tick: `mixed` over a part of the list. An empty list is unticked. */
export function selectAllState(items: readonly AdminAccount[], ticked: readonly AccountId[]): boolean | "mixed" {
  const count = items.filter((item) => isTicked(ticked, item.id)).length;
  if (count === 0) return false;
  return count === items.length ? true : "mixed";
}

export interface AccountRowView {
  readonly id: AccountId;
  readonly username: string;
  readonly name: string;
  readonly state: RowState;
  /** The last sign-in as the list shows it, `never` if absent. */
  readonly when: string;
}

export function accountRow(account: AdminAccount): AccountRowView {
  return {
    id: account.id,
    username: account.username,
    name: account.name,
    state: enabledState(!account.disabled),
    when: formatWhen(account.lastSignInAt),
  };
}

/** What the Events drawer knows of account ids: id to username. */
export function namesOf(items: readonly AdminAccount[]): Readonly<Record<string, string>> {
  return Object.fromEntries(items.map((item) => [String(item.id), item.username]));
}
