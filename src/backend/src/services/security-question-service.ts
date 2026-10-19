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
  revokeAll: (accountId: string) => Promise<void>;
  secret: string;
  now: () => number;
}) {
  const { store, audit, revokeAll, secret, now } = deps;
  const typed = (username: string): string => username.trim().slice(0, USERNAME_MAX);

  /** The account's question when it has one; the stable decoy of the username otherwise (section 2.4). */
  async function questionFor(username: string): Promise<string> {
    const key = usernameKeyOf(username);
    const set = questionOf(await store.accounts.findByUsername(key));
    return set ? questionText(set.question) : decoyQuestion(secret, key);
  }

  return {
    questionFor,

    /**
     * Sets or changes any account's question (docs/54 section 2): the actor is a signed-in admin, so no current
     * password is asked. Changing a question ends no session; the answer is stored only as its hash.
     */
    async setFor(accountId: string, question: number, answer: string, actor: Actor) {
      const normalised = normaliseAnswer(answer);
      if (normalised === "") throw new AppError(ERRORS.accountInvalid, { field: "answer" }, "The answer is not valid.");
      const stored = await store.accounts.find(accountId);
      if (!stored) throw new AppError(ERRORS.accountNotFound);
      const answerHash = await hashPassword(normalised);
      await store.accounts.setSecurityQuestion(stored.account.id, question, answerHash, now());
      await audit.record(actor, {
        action: "account.security_question_set",
        subject: stored.account.id,
        detail: { username: stored.account.username },
      });
      return { set: true as const };
    },

    /** The question to answer for a username; writes nothing (section 2.4). */
    start: async (username: string): Promise<{ question: string }> => ({ question: await questionFor(username) }),

    /** Checks the answer and, when it is right, replaces the password and ends every session (section 2.4). */
    async reset(username: string, answer: string, newPassword: string, actor: Actor): Promise<{ reset: true }> {
      const key = usernameKeyOf(username);
      const normalised = normaliseAnswer(answer);
      const stored = await store.accounts.findByUsername(key);
      const set = stored && !stored.account.disabled ? questionOf(stored) : undefined;
      const matches = await verifyPassword(normalised, set?.hash ?? (await decoyHash));
      if (!stored || !set || !matches || normalised === "") {
        // Audits a wrong or refused answer and answers the one failure (steps 3 and 5).
        await audit.record(actor, { action: "auth.reset_failed", detail: { username: typed(username) } });
        throw new AppError(ERRORS.authResetInvalid);
      }
      const passwordHash = await hashPassword(newPassword);
      const id = stored.account.id;
      await store.transaction(async () => {
        await store.accounts.update({ ...stored.account, passwordHash }, now());
        await revokeAll(id);
      });
      const principal: Principal = { accountId: id, username: stored.account.username };
      await audit.record(
        { ...actor, principal },
        { action: "auth.reset_completed", subject: id, detail: { username: stored.account.username } },
      );
      return { reset: true };
    },
  };
}

export type SecurityQuestionService = ReturnType<typeof createSecurityQuestionService>;
