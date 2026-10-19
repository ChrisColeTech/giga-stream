import { ApiError } from "@giga/http/api-error";
import { ANSWER_TOO_LONG } from "@/constants/account-copy";
import { AUDIT_AFTER_WRITE } from "@/constants/audit-limits";
import { SECURITY_ANSWER_MAX } from "@/constants/security-questions";
import { findAccount, sameId } from "@/lib/account-rows";
import type { AccountId } from "@/types/admin-account";
import {
  DROPPED,
  codeOf,
  done,
  refusal,
  stillSession,
  type AccountFlowDeps,
  type FlowResult,
} from "./account-flow-support";

/** Sets or replaces a selected account's security question, `PUT /api/admin/accounts/:id/security-question` (docs/54
 *  section 2). The actor is the signed-in admin, so no current password is asked; a question is not a credential, so
 *  nothing is signed out and the session is never ended. The backend answers `{ set: true }` (never the account), so
 *  the flow upserts the held row with its flag flipped: that is how the badge turns `Set` without a re-read. A save says
 *  nothing (the re-read audit row is the record). The answer goes to the service and nowhere else: never a notice, an
 *  event, the store or an error. A gone account (`404 account.not_found`) closes the workspace with the standard
 *  not-found notice and reads the list again, as a details save does. */
export function createQuestionFlow(deps: AccountFlowDeps, reread: () => Promise<unknown>): {
  saveQuestion: (id: AccountId, question: number, answer: string) => Promise<FlowResult>;
} {
  const { service, store, audit } = deps;
  return {
    saveQuestion: async (id, question, answer) => {
      if (answer.length > SECURITY_ANSWER_MAX) {
        store().say(ANSWER_TOO_LONG, "warn", "Account");
        return { ok: false, sentence: ANSWER_TOO_LONG, field: "answer" };
      }
      const serial = store().serial;
      try {
        await service.saveQuestion(id, { question, answer });
        if (!stillSession(store, serial)) return DROPPED;
        const held = findAccount(store().accounts.items, id);
        if (held !== undefined) store().accountUpsert({ ...held, securityQuestionSet: true });
        const actor = store().actor;
        if (actor !== null && sameId(actor.id, id)) store().updateActor({ ...actor, securityQuestionSet: true });
        void audit.reload(AUDIT_AFTER_WRITE);
        return done(undefined);
      } catch (error: unknown) {
        if (!stillSession(store, serial)) return DROPPED;
        if (codeOf(error) === "account.not_found") {
          const result = refusal(store(), error);
          store().closeWorkspace("accounts");
          void reread();
          return result;
        }
        const field = error instanceof ApiError && (error.field === "answer" || error.field === "question") ? error.field : undefined;
        return refusal(store(), error, field);
      }
    },
  };
}
