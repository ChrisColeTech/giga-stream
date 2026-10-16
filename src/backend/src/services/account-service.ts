import { randomUUID } from "node:crypto";

import { AppError, ERRORS } from "../constants/errors.js";
import type { StoredAccount } from "../store/account-repository.js";
import type { Store } from "../store/store.js";
import type { AccountCreate, AccountPatch, AdminAccount } from "../types/account.js";
import type { Actor, AuditService } from "./audit-service.js";
import { hashPassword } from "./password.js";

/**
 * Admin accounts (docs/03 section 7.11). Changing a password, role or `disabled`, or deleting an account,
 * ends all of its sessions; the last enabled owner can never be demoted, disabled or deleted.
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

  function assertEmailFree(email: string, exceptId?: string): void {
    const holder = store.accounts.findByEmail(email);
    if (holder && holder.account.id !== exceptId) throw new AppError(ERRORS.accountEmailTaken, { field: "email" });
  }

  /** True when this account is an enabled owner and no other enabled owner exists. */
  const isLastOwner = (a: AdminAccount): boolean =>
    a.role === "owner" && !a.disabled && store.accounts.enabledOwners() <= 1;

  return {
    list: (): { items: AdminAccount[] } => ({ items: store.accounts.list().map((s) => s.account) }),

    get: (id: string): AdminAccount => existing(id).account,

    async create(input: AccountCreate, actor: Actor): Promise<AdminAccount> {
      assertEmailFree(input.email);
      const id = `acct_${randomUUID()}`;
      const passwordHash = await hashPassword(input.password);
      store.accounts.insert({ id, email: input.email, name: input.name, role: input.role, passwordHash, disabled: false }, now());
      audit.record(actor, { action: "account.created", subject: id, detail: { email: input.email, role: input.role } });
      return existing(id).account;
    },

    async update(id: string, patch: AccountPatch, actor: Actor): Promise<AdminAccount> {
      const current = existing(id);
      const a = current.account;
      if (patch.email !== undefined) assertEmailFree(patch.email, id);
      const demoted = patch.role === "editor" && a.role === "owner";
      const disabling = patch.disabled === true && !a.disabled;
      if ((demoted || disabling) && isLastOwner(a)) throw new AppError(ERRORS.accountLastOwner);
      const passwordHash = patch.password === undefined ? current.passwordHash : await hashPassword(patch.password);
      const revokes = patch.password !== undefined || (patch.role !== undefined && patch.role !== a.role)
        || (patch.disabled !== undefined && patch.disabled !== a.disabled);
      store.transaction(() => {
        store.accounts.update(
          {
            id,
            email: patch.email ?? a.email,
            name: patch.name ?? a.name,
            role: patch.role ?? a.role,
            disabled: patch.disabled ?? a.disabled,
            passwordHash,
          },
          now(),
        );
        if (revokes) revokeAll(id);
      });
      const changed = Object.keys(patch).filter((k) => k !== "password");
      audit.record(actor, {
        action: "account.updated",
        subject: id,
        detail: { fields: patch.password === undefined ? changed : [...changed, "password"] },
      });
      return existing(id).account;
    },

    remove(id: string, actor: Actor): { id: string } {
      const current = existing(id);
      if (isLastOwner(current.account)) throw new AppError(ERRORS.accountLastOwner);
      store.accounts.remove(id);
      audit.record(actor, { action: "account.deleted", subject: id, detail: { email: current.account.email } });
      return { id };
    },
  };
}

export type AccountService = ReturnType<typeof createAccountService>;
