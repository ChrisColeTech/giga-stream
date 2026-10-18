import { randomUUID } from "node:crypto";

import { AppError, ERRORS } from "../constants/errors.js";
import type { StoredAccount } from "../store/account-repository.js";
import type { Store } from "../store/store.js";
import type { AccountCreate, AccountPatch, AdminAccount } from "../types/account.js";
import type { Actor, AuditService } from "./audit-service.js";
import { hashPassword } from "./password.js";

/**
 * Admin accounts (docs/03 section 7.11); every account is equal (docs/26 D22). Changing a password or `disabled`,
 * or deleting an account, ends all of its sessions; the last enabled account can never be disabled or deleted.
 */
export function createAccountService(deps: {
  store: Store;
  audit: AuditService;
  revokeAll: (accountId: string) => void;
  now: () => number;
}) {
  const { store, audit, revokeAll, now } = deps;

  function existing(id: string): StoredAccount {
    const found = store.accounts.find(id);
    if (!found) throw new AppError(ERRORS.accountNotFound);
    return found;
  }

  function assertUsernameFree(username: string, exceptId?: string): void {
    const holder = store.accounts.findByUsername(username);
    if (holder && holder.account.id !== exceptId) {
      throw new AppError(ERRORS.accountUsernameTaken, { field: "username" });
    }
  }

  /** True when this account is enabled and no other enabled account exists. */
  const isLastAdmin = (a: AdminAccount): boolean => !a.disabled && store.accounts.enabledCount() <= 1;

  return {
    list: (): { items: AdminAccount[] } => ({ items: store.accounts.list().map((s) => s.account) }),

    get: (id: string): AdminAccount => existing(id).account,

    async create(input: AccountCreate, actor: Actor): Promise<AdminAccount> {
      assertUsernameFree(input.username);
      const id = `acct_${randomUUID()}`;
      const passwordHash = await hashPassword(input.password);
      store.accounts.insert({ id, username: input.username, passwordHash, disabled: false }, now());
      audit.record(actor, { action: "account.created", subject: id, detail: { username: input.username } });
      return existing(id).account;
    },

    async update(id: string, patch: AccountPatch, actor: Actor): Promise<AdminAccount> {
      const current = existing(id);
      const a = current.account;
      if (patch.username !== undefined) assertUsernameFree(patch.username, id);
      const disabling = patch.disabled === true && !a.disabled;
      if (disabling && isLastAdmin(a)) throw new AppError(ERRORS.accountLastAdmin);
      const passwordHash = patch.password === undefined ? current.passwordHash : await hashPassword(patch.password);
      const revokes = patch.password !== undefined || (patch.disabled !== undefined && patch.disabled !== a.disabled);
      store.transaction(() => {
        store.accounts.update(
          {
            id,
            username: patch.username ?? a.username,
            disabled: patch.disabled ?? a.disabled,
            passwordHash,
          },
          now(),
        );
        if (revokes) revokeAll(id);
      });
      const changed = Object.keys(patch).filter((k) => k !== "password");
      const saved = existing(id).account;
      audit.record(actor, {
        action: "account.updated",
        subject: id,
        detail: { username: saved.username, fields: patch.password === undefined ? changed : [...changed, "password"] },
      });
      return saved;
    },

    remove(id: string, actor: Actor): { id: string } {
      const current = existing(id);
      if (isLastAdmin(current.account)) throw new AppError(ERRORS.accountLastAdmin);
      store.accounts.remove(id);
      audit.record(actor, { action: "account.deleted", subject: id, detail: { username: current.account.username } });
      return { id };
    },
  };
}

export type AccountService = ReturnType<typeof createAccountService>;
