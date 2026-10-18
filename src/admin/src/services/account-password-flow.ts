import { PASSWORD_CHANGED_NOTICE } from "@/constants/sign-in-copy";
import { AUDIT_AFTER_WRITE } from "@/constants/audit-limits";
import { passwordSet } from "@/constants/account-copy";
import { passwordBody } from "@/lib/account-body";
import { passwordLength } from "@/lib/account-checks";
import { sameId } from "@/lib/account-rows";
import type { AccountId } from "@/types/admin-account";
import {
  DROPPED,
  done,
  refusal,
  stillSession,
  type AccountFlowDeps,
  type FlowResult,
} from "./account-flow-support";

/** Set a new password on an account (`35` decision 6): always `PATCH /api/admin-accounts/:id { password }`, which revokes
 *  that account's sessions. On the signed-in account the token is already dead, so the session ends locally with the gate's
 *  `Password changed. Sign in again.` and no logout call is made. On failure the field is not cleared (the caller keeps it).
 *  The password goes to the service and nowhere else. */
export function createPasswordFlow(deps: AccountFlowDeps): {
  setPassword: (id: AccountId, password: string) => Promise<FlowResult>;
} {
  const { service, store, audit } = deps;
  return {
    setPassword: async (id, password) => {
      const bad = passwordLength(password);
      if (bad !== null) {
        store().say(bad, "warn", "Account");
        return { ok: false, sentence: bad, field: "password" };
      }
      const serial = store().serial;
      try {
        const account = await service.update(id, passwordBody(password));
        if (!stillSession(store, serial)) return DROPPED;
        const actor = store().actor;
        if (actor !== null && sameId(actor.id, account.id)) {
          store().endSession(PASSWORD_CHANGED_NOTICE);
          return done(undefined);
        }
        store().accountUpsert(account);
        store().say(passwordSet(account.email));
        void audit.reload(AUDIT_AFTER_WRITE);
        return done(undefined);
      } catch (error: unknown) {
        return stillSession(store, serial) ? refusal(store(), error, "password") : DROPPED;
      }
    },
  };
}
