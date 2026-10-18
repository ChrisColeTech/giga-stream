import { AppError, ERRORS } from "../constants/errors.js";
import { USERNAME_MAX } from "../constants/limits.js";
import type { StoredAccount } from "../store/account-repository.js";
import type { Store } from "../store/store.js";
import type { Principal } from "../types/account.js";
import type { Actor, AuditService } from "./audit-service.js";
import { decoyHash, hashPassword, verifyPassword } from "./password.js";
import { decoyQuestion, normaliseAnswer, questionText, usernameKeyOf } from "./security-answer.js";

/** The stored question and answer hash of an account that has set one. */
const questionOf = (stored: StoredAccount | undefined): { question: number; hash: string } | undefined =>
  stored && stored.securityQuestion !== null && stored.securityAnswerHash !== null
    ? { question: stored.securityQuestion, hash: stored.securityAnswerHash }
    : undefined;

/**
 * The password reset by security question (docs/40). Every answer to an unauthenticated caller is the same
 * whatever the username is: an account, an unknown name, an account with no question, a disabled account.
 */
export function createSecurityQuestionService(deps: {
  store: Store;
  audit: AuditService;
  revokeAll: (accountId: string) => void;
  secret: string;
  now: () => number;
}) {
  const { store, audit, revokeAll, secret, now } = deps;
  const typed = (username: string): string => username.trim().slice(0, USERNAME_MAX);

  /** The account's question when it has one; the stable decoy of the username otherwise (section 2.4). */
  function questionFor(username: string): string {
    const key = usernameKeyOf(username);
    const set = questionOf(store.accounts.findByUsername(key));
    return set ? questionText(set.question) : decoyQuestion(secret, key);
  }

  /** Audits a wrong or refused answer and answers the one failure (steps 3 and 5). */
  function refuse(username: string, actor: Actor): never {
    audit.record(actor, { action: "auth.reset_failed", detail: { username: typed(username) } });
    throw new AppError(ERRORS.authResetInvalid);
  }

  return {
    questionFor,

    /** Sets or changes the signed-in account's own question; the current password is required (section 2.3). */
    async set(principal: Principal, currentPassword: string, question: number, answer: string, actor: Actor) {
      const normalised = normaliseAnswer(answer);
      if (normalised === "") throw new AppError(ERRORS.accountInvalid, { field: "answer" }, "The answer is not valid.");
      const stored = store.accounts.find(principal.accountId);
      if (!stored || !(await verifyPassword(currentPassword, stored.passwordHash))) {
        throw new AppError(ERRORS.authInvalidCredentials, { field: "currentPassword" });
      }
      const answerHash = await hashPassword(normalised);
      store.accounts.setSecurityQuestion(stored.account.id, question, answerHash, now());
      audit.record(
        { ...actor, principal },
        {
          action: "auth.security_question_set",
          subject: stored.account.id,
          detail: { username: stored.account.username },
        },
      );
      return { set: true as const };
    },

    /** The question to answer for a username; writes nothing (section 2.4). */
    start(username: string): { question: string } {
      return { question: questionFor(username) };
    },

    /** Checks the answer and, when it is right, replaces the password and ends every session (section 2.4). */
    async reset(username: string, answer: string, newPassword: string, actor: Actor): Promise<{ reset: true }> {
      const key = usernameKeyOf(username);
      const normalised = normaliseAnswer(answer);
      const stored = store.accounts.findByUsername(key);
      const set = stored && !stored.account.disabled ? questionOf(stored) : undefined;
      const matches = await verifyPassword(normalised, set?.hash ?? (await decoyHash));
      if (!stored || !set || !matches || normalised === "") refuse(username, actor);

      const passwordHash = await hashPassword(newPassword);
      const id = stored.account.id;
      store.transaction(() => {
        store.accounts.update({ ...stored.account, passwordHash }, now());
        revokeAll(id);
      });
      const principal: Principal = { accountId: id, username: stored.account.username };
      audit.record(
        { ...actor, principal },
        { action: "auth.reset_completed", subject: id, detail: { username: stored.account.username } },
      );
      return { reset: true };
    },
  };
}

export type SecurityQuestionService = ReturnType<typeof createSecurityQuestionService>;
