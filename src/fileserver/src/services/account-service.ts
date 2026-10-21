import { createHash, randomBytes, randomUUID } from "node:crypto";

import { AppError } from "../lib/app-error.js";
import { runAdminTransaction, type AdminDatabase } from "../store/admin-database.js";
import type { AccountRepository, StoredAccount } from "../store/account-repository.js";
import type { Account, Principal, Session } from "../types/account.js";
import {
  decoyQuestion, normaliseAnswer, questionText, signAccessToken, verifyAccessToken,
} from "./account-security.js";
import { decoyHash, hashPassword, verifyPassword } from "./password.js";
import type { Actor, AuditService } from "./audit-service.js";
import {
  invalidCredentials, invalidRefresh, isUnique, unauthorized, usernameTaken,
} from "./account-errors.js";

const ACCESS_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const REFRESH_TTL_MS = 365 * 24 * 60 * 60 * 1000;
const BEARER = /^Bearer\s+(\S+)$/i;
const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");
export function createAccountService(deps: {
  accounts: AccountRepository; audit: AuditService; database: AdminDatabase;
  secret: string; now: () => number;
}) {
  const { accounts, audit, database, secret, now } = deps;

  function tokens(stored: StoredAccount, refreshToken: string, at: number): Session {
    return {
      accessToken: signAccessToken(stored.account.id, stored.sessionVersion, at, secret),
      accessExpiresAt: at + ACCESS_TTL_MS,
      refreshToken,
      refreshExpiresAt: at + REFRESH_TTL_MS,
      account: stored.account,
    };
  }

  async function issue(stored: StoredAccount): Promise<Session> {
    const at = now();
    const refreshToken = randomBytes(32).toString("base64url");
    await accounts.insertRefresh(randomUUID(), stored.account.id, sha256(refreshToken), at, at + REFRESH_TTL_MS);
    return tokens(stored, refreshToken, at);
  }

  async function authenticate(authorization: string | undefined): Promise<Principal> {
    const token = authorization ? BEARER.exec(authorization)?.[1] : undefined;
    const claims = token === undefined ? undefined : verifyAccessToken(token, secret, now());
    const stored = claims === undefined ? undefined : await accounts.find(claims.sub);
    if (!claims || !stored || stored.account.disabled || stored.sessionVersion !== claims.ver) throw unauthorized();
    return { accountId: stored.account.id, username: stored.account.username, kind: stored.account.kind };
  }

  return {
    authenticate,
    async register(input: {
      username: string; password: string; securityQuestion: number; securityAnswer: string;
    }, actor: Actor): Promise<Session> {
      const answer = normaliseAnswer(input.securityAnswer);
      if (answer === "") {
        throw new AppError(
          "account.invalid", 422, "The security answer is not valid.", { field: "securityAnswer" },
        );
      }
      const at = now();
      const refreshToken = randomBytes(32).toString("base64url");
      try {
        const id = `acct_${randomUUID()}`;
        const write = {
          id, username: input.username, passwordHash: await hashPassword(input.password),
          question: input.securityQuestion, answerHash: await hashPassword(answer), at,
          refreshId: randomUUID(), refreshHash: sha256(refreshToken), refreshExpiresAt: at + REFRESH_TTL_MS,
        };
        const stored = await runAdminTransaction(database, async () => {
          const created = await accounts.register(write);
          const principal = {
            accountId: created.account.id, username: created.account.username, kind: created.account.kind,
          };
          await audit.record({ ...actor, principal }, {
            action: "account.created", subject: id,
            detail: { username: created.account.username, kind: "user" },
          });
          return created;
        });
        return tokens(stored, refreshToken, at);
      } catch (error) {
        if (isUnique(error)) throw usernameTaken();
        throw error;
      }
    },
    async login(username: string, password: string, actor: Actor): Promise<Session> {
      const stored = await accounts.findByUsername(username);
      const matches = await verifyPassword(password, stored?.passwordHash ?? (await decoyHash));
      if (!stored || !matches || stored.account.disabled) {
        await audit.record(actor, { action: "auth.login_failed", detail: { username: username.trim().slice(0, 254) } });
        throw invalidCredentials();
      }
      return runAdminTransaction(database, async () => {
        await accounts.recordSignIn(stored.account.id, now());
        const fresh = (await accounts.find(stored.account.id)) ?? stored;
        const principal = {
          accountId: fresh.account.id, username: fresh.account.username, kind: fresh.account.kind,
        };
        const session = await issue(fresh);
        await audit.record({ ...actor, principal }, { action: "auth.login" });
        return session;
      });
    },
    async refresh(refreshToken: string): Promise<Session> {
      const at = now();
      const next = randomBytes(32).toString("base64url");
      const result = await accounts.rotateRefresh({
        oldHash: sha256(refreshToken), id: randomUUID(), newHash: sha256(next), at,
        expiresAt: at + REFRESH_TTL_MS,
      });
      if (result.kind !== "ok") throw invalidRefresh();
      return tokens(result.account, next, at);
    },
    async logout(refreshToken: string, actor: Actor): Promise<{ signedOut: true }> {
      return runAdminTransaction(database, async () => {
        const stored = await accounts.logout(sha256(refreshToken), now());
        if (stored === undefined) throw invalidRefresh();
        const principal = {
          accountId: stored.account.id, username: stored.account.username, kind: stored.account.kind,
        };
        await audit.record({ ...actor, principal }, { action: "auth.logout" });
        return { signedOut: true };
      });
    },
    async me(principal: Principal): Promise<Account> {
      const stored = await accounts.find(principal.accountId);
      if (!stored) throw unauthorized();
      return stored.account;
    },
    async updateUsername(principal: Principal, username: string, actor: Actor): Promise<Account> {
      try {
        return await runAdminTransaction(database, async () => {
          const stored = await accounts.updateUsername(principal.accountId, username, now());
          if (!stored) throw unauthorized();
          await audit.record({ ...actor, principal }, {
            action: "account.updated", subject: principal.accountId,
            detail: { username: stored.account.username, fields: ["username"] },
          });
          return stored.account;
        });
      } catch (error) {
        if (isUnique(error)) throw usernameTaken();
        throw error;
      }
    },
    async changePassword(
      principal: Principal, current: string, next: string, actor: Actor,
    ): Promise<{ changed: true }> {
      const stored = await accounts.find(principal.accountId);
      if (!stored || !(await verifyPassword(current, stored.passwordHash))) throw invalidCredentials();
      const hash = await hashPassword(next);
      return runAdminTransaction(database, async () => {
        await accounts.replacePassword(stored.account.id, hash, now());
        await audit.record({ ...actor, principal }, {
          action: "auth.password_changed", subject: stored.account.id,
        });
        return { changed: true };
      });
    },
    async resetStart(username: string): Promise<{ question: string }> {
      const stored = await accounts.findByUsername(username);
      const question = stored?.securityQuestion;
      const text = question === null || question === undefined
        ? decoyQuestion(secret, username)
        : questionText(question);
      return { question: text };
    },
    async reset(username: string, answer: string, password: string, actor: Actor): Promise<{ reset: true }> {
      const stored = await accounts.findByUsername(username);
      const normalised = normaliseAnswer(answer);
      const matches = await verifyPassword(normalised, stored?.securityAnswerHash ?? (await decoyHash));
      if (!stored || stored.account.disabled || stored.securityQuestion === null || !matches || normalised === "") {
        await audit.record(actor, {
          action: "auth.reset_failed", detail: { username: username.trim().slice(0, 254) },
        });
        throw new AppError("auth.reset_invalid", 401, "That reset answer is not valid.");
      }
      const hash = await hashPassword(password);
      const principal = {
        accountId: stored.account.id, username: stored.account.username, kind: stored.account.kind,
      };
      return runAdminTransaction(database, async () => {
        await accounts.replacePassword(stored.account.id, hash, now());
        await audit.record({ ...actor, principal }, {
          action: "auth.reset_completed", subject: stored.account.id,
          detail: { username: stored.account.username },
        });
        return { reset: true };
      });
    },
  };
}

export type AccountService = ReturnType<typeof createAccountService>;
