import { AppError, ERRORS } from "../constants/errors.js";
import { USERNAME_MAX } from "../constants/limits.js";
import { RESET_LOCK_FAILURES, RESET_LOCK_MS } from "../constants/security-questions.js";
import type { StoredAccount } from "../store/account-repository.js";
import type { Store } from "../store/store.js";
import type { Principal } from "../types/account.js";
import type { Actor, AuditService } from "./audit-service.js";
import { decoyHash, hashPassword, verifyPassword } from "./password.js";
import { decoyQuestion, normaliseAnswer, questionText, usernameKeyOf } from "./security-answer.js";
import type { SignInLimiter } from "./sign-in-limiter.js";

/** The stored question and answer hash of an account that has set one. */
const questionOf = (stored: StoredAccount | undefined): { question: number; hash: string } | undefined =>
  stored && stored.securityQuestion !== null && stored.securityAnswerHash !== null
    ? { question: stored.securityQuestion, hash: stored.securityAnswerHash }
    : undefined;

/**
 * The password reset by security question (docs/40). Every answer to an unauthenticated caller is the same
 * whatever the username is: an account, an unknown name, an account with no question, a disabled account, a lock.
 */
export function createSecurityQuestionService(deps: {
  store: Store;
  audit: AuditService;
  limiter: SignInLimiter;
  revokeAll: (accountId: string) => void;
  secret: string;
  now: () => number;
}) {
  const { store, audit, limiter, revokeAll, secret, now } = deps;
  const typed = (username: string): string => username.trim().slice(0, USERNAME_MAX);

  /** The account's question when it has one; the stable decoy of the username otherwise (section 2.4). */
  function questionFor(username: string): string {
    const key = usernameKeyOf(username);
    const set = questionOf(store.accounts.findByUsername(key));
    return set ? questionText(set.question) : decoyQuestion(secret, key);
  }

  /** Counts a wrong or refused answer against the username and answers the one failure (steps 3 and 5). */
  function refuse(username: string, actor: Actor, count: { prior: number } | undefined): never {
    audit.record(actor, { action: "auth.reset_failed", detail: { username: typed(username) } });
    if (count) {
      const failed = count.prior + 1;
      const locked = failed >= RESET_LOCK_FAILURES;
      const key = usernameKeyOf(username);
      store.resetAttempts.recordFailure(key, locked ? 0 : failed, locked ? now() + RESET_LOCK_MS : null);
      if (locked) audit.record(actor, { action: "auth.reset_locked", detail: { username: typed(username) } });
    }
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
    start(username: string, actor: Actor): { question: string } {
      if (!limiter.allow(actor.address ?? "unknown")) throw new AppError(ERRORS.authRateLimited);
      return { question: questionFor(username) };
    },

    /** Checks the answer and, when it is right, replaces the password and ends every session (section 2.4). */
    async reset(username: string, answer: string, newPassword: string, actor: Actor): Promise<{ reset: true }> {
      if (!limiter.allow(actor.address ?? "unknown")) throw new AppError(ERRORS.authRateLimited);
      const key = usernameKeyOf(username);
      const normalised = normaliseAnswer(answer);
      const attempt = store.resetAttempts.find(key);
      if (attempt?.lockedUntil != null && attempt.lockedUntil > now()) {
        // The lock refuses even the right answer, and checks nothing: a dummy verify keeps the timing.
        await verifyPassword(normalised, await decoyHash);
        refuse(username, actor, undefined);
      }
      // A lock that has run out starts the count again from zero (the lock already set it to zero).
      const prior = attempt && attempt.lockedUntil === null ? attempt.failed : 0;
      const stored = store.accounts.findByUsername(key);
      const set = stored && !stored.account.disabled ? questionOf(stored) : undefined;
      const matches = await verifyPassword(normalised, set?.hash ?? (await decoyHash));
      if (!stored || !set || !matches || normalised === "") refuse(username, actor, { prior });

      const passwordHash = await hashPassword(newPassword);
      const id = stored.account.id;
      store.transaction(() => {
        store.accounts.update({ ...stored.account, passwordHash }, now());
        revokeAll(id);
        store.accounts.clearAttempts(id);
        store.resetAttempts.remove(key);
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
