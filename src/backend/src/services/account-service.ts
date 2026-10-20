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
  revokeAll: (accountId: string) => Promise<void>;
  now: () => number;
}) {
  const { store, audit, revokeAll, now } = deps;

  async function existing(id: string): Promise<StoredAccount> {
    const found = await store.accounts.find(id);
    if (!found) throw new AppError(ERRORS.accountNotFound);
    return found;
  }

  async function assertUsernameFree(username: string, exceptId?: string): Promise<void> {
    const holder = await store.accounts.findByUsername(username);
    if (holder && holder.account.id !== exceptId) {
      throw new AppError(ERRORS.accountUsernameTaken, { field: "username" });
    }
  }

  /** True when this account is enabled and no other enabled account exists. */
  const isLastAdmin = async (a: AdminAccount): Promise<boolean> => !a.disabled && (await store.accounts.enabledCount()) <= 1;

  return {
    list: async (): Promise<{ items: AdminAccount[] }> =>
      ({ items: (await store.accounts.list()).map((s) => s.account) }),

    get: async (id: string): Promise<AdminAccount> => (await existing(id)).account,

    async create(input: AccountCreate, actor: Actor): Promise<AdminAccount> {
      await assertUsernameFree(input.username);
      const id = `acct_${randomUUID()}`;
      const passwordHash = await hashPassword(input.password);
      await store.accounts.insert(
        { id, username: input.username, kind: input.kind, passwordHash, disabled: false },
        now(),
      );
      await audit.record(actor, {
        action: "account.created",
        subject: id,
        detail: { username: input.username, kind: input.kind },
      });
      return (await existing(id)).account;
    },

    async update(id: string, patch: AccountPatch, actor: Actor): Promise<AdminAccount> {
      const current = await existing(id);
      const a = current.account;
      if (patch.username !== undefined) await assertUsernameFree(patch.username, id);
      const disabling = patch.disabled === true && !a.disabled;
      if (disabling && (await isLastAdmin(a))) throw new AppError(ERRORS.accountLastAdmin);
      const passwordHash = patch.password === undefined ? current.passwordHash : await hashPassword(patch.password);
      const revokes = patch.password !== undefined || (patch.disabled !== undefined && patch.disabled !== a.disabled);
      await store.transaction(async () => {
        await store.accounts.update(
          {
            id,
            username: patch.username ?? a.username,
            kind: a.kind, // a patch never moves an account between kinds (docs/62 section 3.7)
            disabled: patch.disabled ?? a.disabled,
            passwordHash,
          },
          now(),
        );
        if (revokes) await revokeAll(id);
      });
      const changed = Object.keys(patch).filter((k) => k !== "password");
      const saved = (await existing(id)).account;
      await audit.record(actor, {
        action: "account.updated",
        subject: id,
        detail: { username: saved.username, fields: patch.password === undefined ? changed : [...changed, "password"] },
      });
      return saved;
    },

    async remove(id: string, actor: Actor): Promise<{ id: string }> {
      const current = await existing(id);
      if (await isLastAdmin(current.account)) throw new AppError(ERRORS.accountLastAdmin);
      await store.accounts.remove(id);
      await audit.record(actor, { action: "account.deleted", subject: id, detail: { username: current.account.username } });
      return { id };
    },
  };
}

export type AccountService = ReturnType<typeof createAccountService>;
