import { pruneTicks, sortedByUsername, upsertAccount, withoutAccount } from "@/lib/account-rows";
import type { AccountId, AdminAccount } from "@/types/admin-account";
import type { SliceGet, SliceSet } from "./slices/slice-host";

/* The Accounts tab's data, a slice of the one store (`35` section 5.3). It holds facts only: no promise, no timer. The
 * flows (`services/account-flows.ts`) read the backend and hand the answers to these setters. `unreachable` is set by a
 * transport failure and cleared by the next successful read; while it is set every write is disabled with the
 * unreachable sentence. The actions carry the record in their name because the actions of every tab share one store. */

export type AccountsStatus = "idle" | "loading" | "ready" | "failed";

export interface AccountsState {
  readonly status: AccountsStatus;
  readonly items: readonly AdminAccount[];
  readonly unreachable: boolean;
  readonly ticked: readonly AccountId[];
}

export const NO_ACCOUNTS: AccountsState = { status: "idle", items: [], unreachable: false, ticked: [] };

export interface AccountsSlice {
  accounts: AccountsState;
  accountsStartLoad: () => void;
  /** A list read answered: it replaces the items, clears `unreachable` and drops the ticks of rows that are gone. */
  accountsLoaded: (items: readonly AdminAccount[]) => void;
  /** A list read failed: the last items stay. */
  accountsLoadFailed: (unreachable: boolean) => void;
  accountUpsert: (account: AdminAccount) => void;
  accountRemove: (id: AccountId) => void;
  accountTick: (id: AccountId, on: boolean) => void;
  accountsTickAll: (on: boolean) => void;
  /** Leaves exactly these ids ticked (a bulk action unticks the rows it finished). */
  accountsSetTicked: (ids: readonly AccountId[]) => void;
  accountsMarkUnreachable: (unreachable: boolean) => void;
}

export function createAccountsSlice(set: SliceSet<AccountsSlice>, get: SliceGet<AccountsSlice>): AccountsSlice {
  const patch = (next: Partial<AccountsState>): void => set({ accounts: { ...get().accounts, ...next } });
  const withItems = (items: readonly AdminAccount[]): Partial<AccountsState> => ({
    items,
    ticked: pruneTicks(get().accounts.ticked, items),
  });
  return {
    accounts: NO_ACCOUNTS,
    accountsStartLoad: () => patch({ status: "loading" }),
    accountsLoaded: (items) => patch({ status: "ready", unreachable: false, ...withItems(sortedByUsername(items)) }),
    accountsLoadFailed: (unreachable) => patch({ status: "failed", unreachable }),
    accountUpsert: (account) => patch(withItems(upsertAccount(get().accounts.items, account))),
    accountRemove: (id) => patch(withItems(withoutAccount(get().accounts.items, id))),
    accountTick: (id, on) => {
      const rest = get().accounts.ticked.filter((one) => String(one) !== String(id));
      patch({ ticked: on ? [...rest, id] : rest });
    },
    accountsTickAll: (on) => patch({ ticked: on ? get().accounts.items.map((item) => item.id) : [] }),
    accountsSetTicked: (ids) => patch({ ticked: pruneTicks(ids, get().accounts.items) }),
    accountsMarkUnreachable: (unreachable) => patch({ unreachable }),
  };
}
