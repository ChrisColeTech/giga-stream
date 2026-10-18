import {
  ACCOUNT_GONE,
  OWN_DELETED_NOTICE,
  OWN_DISABLED_NOTICE,
  accountCreated,
  accountDeleted,
  accountSaved,
  accountSavedSignedOut,
  unreadableAccounts,
} from "@/constants/account-copy";
import { AUDIT_AFTER_WRITE, AUDIT_PAGE } from "@/constants/audit-limits";
import { createBody } from "@/lib/account-body";
import { firstCreateRefusal, firstSaveRefusal } from "@/lib/account-checks";
import { changedFields, isEmptyPatch, type AccountDraft, type NewAccountDraft } from "@/lib/account-draft";
import { findAccount, sameId } from "@/lib/account-rows";
import type { AccountId, AdminAccount } from "@/types/admin-account";
import {
  DROPPED,
  codeOf,
  done,
  refusal,
  stillSession,
  type AccountFlowDeps,
  type FlowRefused,
  type FlowResult,
} from "./account-flow-support";
import { createPasswordFlow } from "./account-password-flow";

export type { AccountField, FlowResult } from "./account-flow-support";

const BAD_ANSWER = "backend.bad_response";

export interface AccountFlows {
  create: (draft: NewAccountDraft) => Promise<FlowResult>;
  save: (id: AccountId, draft: AccountDraft) => Promise<FlowResult<AdminAccount | null>>;
  setPassword: (id: AccountId, password: string) => Promise<FlowResult>;
  remove: (id: AccountId) => Promise<FlowResult>;
  /** Reads the list. Does nothing while a read is already running. */
  load: () => Promise<FlowResult>;
  /** The list and the audit tail, read together (the list's Refresh). */
  refresh: () => Promise<FlowResult>;
}

/** The Accounts tab's orchestration (`35` section 5.4). The store and the service are injected, so a test drives it with
 *  fakes. Each flow records the session's serial before it awaits and writes only if the session is unchanged after; a
 *  failure is said once as a `warn` notice and returned typed, so the form can put a field's refusal under its row. A
 *  password is passed through to the service and nowhere else: never a notice, an event, the store or an error. */
export function createAccountFlows(deps: AccountFlowDeps): AccountFlows {
  const { service, store, audit } = deps;
  const isOwn = (account: AdminAccount): boolean => {
    const actor = store().actor;
    return actor !== null && sameId(actor.id, account.id);
  };
  const rejected = (sentence: string, field?: "username" | "password"): FlowRefused => {
    store().say(sentence, "warn", "Account");
    return { ok: false, sentence, ...(field !== undefined && { field }) };
  };

  async function load(): Promise<FlowResult> {
    if (store().accounts.status === "loading") return done(undefined);
    const serial = store().serial;
    store().accountsStartLoad();
    try {
      const list = await service.list();
      if (!stillSession(store, serial)) return DROPPED;
      store().accountsLoaded(list.items);
      if (list.unreadable > 0) store().say(unreadableAccounts(list.unreadable), "warn", "Account");
      return done(undefined);
    } catch (error: unknown) {
      if (!stillSession(store, serial)) return DROPPED;
      store().accountsLoadFailed(codeOf(error) === "backend.unreachable");
      return refusal(store(), error);
    }
  }

  /** A write whose answer could not be read may still have happened: read the list again. */
  const afterFailure = (error: unknown, field?: "username" | "enabled"): FlowRefused => {
    const result = refusal(store(), error, field);
    if (codeOf(error) === BAD_ANSWER) void load();
    return result;
  };

  async function create(draft: NewAccountDraft): Promise<FlowResult> {
    const bad = firstCreateRefusal(draft);
    if (bad !== null) return rejected(bad.sentence, bad.field);
    const serial = store().serial;
    try {
      const account = await service.create(createBody(draft));
      if (!stillSession(store, serial)) return DROPPED;
      store().accountUpsert(account);
      store().say(accountCreated(account.username));
      void audit.reload(AUDIT_AFTER_WRITE);
      return done(undefined);
    } catch (error: unknown) {
      return stillSession(store, serial) ? afterFailure(error) : DROPPED;
    }
  }

  async function save(id: AccountId, draft: AccountDraft): Promise<FlowResult<AdminAccount | null>> {
    const saved = findAccount(store().accounts.items, id);
    if (saved === undefined) return gone();
    const patch = changedFields(saved, draft);
    if (isEmptyPatch(patch)) return done(null);
    const bad = firstSaveRefusal(patch);
    if (bad !== null) return rejected(bad.sentence, bad.field);
    const serial = store().serial;
    try {
      const account = await service.update(id, patch);
      if (!stillSession(store, serial)) return DROPPED;
      store().accountUpsert(account);
      if (isOwn(account) && patch.disabled === true) {
        store().endSession(OWN_DISABLED_NOTICE);
        return done(account);
      }
      if (isOwn(account)) store().updateActor(account);
      const signedOut = patch.disabled === true;
      store().say(signedOut ? accountSavedSignedOut(account.username) : accountSaved(account.username));
      void audit.reload(AUDIT_AFTER_WRITE);
      return done(account);
    } catch (error: unknown) {
      if (!stillSession(store, serial)) return DROPPED;
      if (codeOf(error) === "account.not_found") {
        const result = refusal(store(), error);
        store().closeWorkspace("accounts");
        void load();
        return result;
      }
      return afterFailure(error, codeOf(error) === "account.last_admin" ? "enabled" : undefined);
    }
  }

  function gone(): FlowRefused {
    store().closeWorkspace("accounts");
    return rejected(ACCOUNT_GONE);
  }

  async function remove(id: AccountId): Promise<FlowResult> {
    const account = findAccount(store().accounts.items, id);
    if (account === undefined) return gone();
    const serial = store().serial;
    try {
      await service.remove(id);
      if (!stillSession(store, serial)) return DROPPED;
      store().accountRemove(id);
      if (isOwn(account)) {
        store().endSession(OWN_DELETED_NOTICE);
        return done(undefined);
      }
      if (store().workspaces.accounts === String(id)) store().closeWorkspace("accounts");
      store().say(accountDeleted(account.username));
      void audit.reload(AUDIT_AFTER_WRITE);
      return done(undefined);
    } catch (error: unknown) {
      if (!stillSession(store, serial)) return DROPPED;
      const code = codeOf(error);
      if (code === "account.not_found") store().accountRemove(id);
      const result = afterFailure(error);
      if (code === "account.not_found" || code === "account.last_admin") void load();
      return result;
    }
  }

  const refresh = async (): Promise<FlowResult> => {
    const [result] = await Promise.all([load(), audit.reload(AUDIT_PAGE)]);
    return result;
  };

  return { create, save, remove, load, refresh, ...createPasswordFlow(deps) };
}
