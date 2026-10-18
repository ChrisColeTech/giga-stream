import { notConnected } from "./not-connected";
import type { AccountState } from "./schemas/account-state-schema";

/** `GET` and `PUT /api/auth/me/state` (`29` section 12.2): the signed-in account's saved appearance and layout. NOT
 *  CONNECTED: refuses until Settings persistence is wired; appearance then stays at the defaults for the run. */
export interface AccountStateService {
  read: () => Promise<AccountState>;
  write: (patch: Partial<Pick<AccountState, "settings" | "shell">>) => Promise<AccountState>;
}

export const accountState: AccountStateService = {
  read: () => notConnected("accountState.read"),
  write: () => notConnected("accountState.write"),
};
