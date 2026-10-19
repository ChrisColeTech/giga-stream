import { createHash, randomBytes, randomUUID } from "node:crypto";

import { AppError, ERRORS } from "../constants/errors.js";
import {
  ACCESS_TOKEN_TTL_MS,
  REFRESH_TOKEN_BYTES,
  REFRESH_TOKEN_TTL_MS,
} from "../constants/limits.js";
import type { StoredAccount } from "../store/account-repository.js";
import type { Store } from "../store/store.js";
import type { AdminAccount, Principal, Session } from "../types/account.js";
import type { Actor, AuditService } from "./audit-service.js";
import { AUDIENCE, ISSUER, signAccessToken, verifyAccessToken } from "./jwt.js";
import { decoyHash, hashPassword, verifyPassword } from "./password.js";

const BEARER = /^Bearer\s+(\S+)$/i;
const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");

/** Sign-in and tokens (docs/03 section 7.12). */
export function createAuthService(deps: {
  store: Store;
  audit: AuditService;
  secret: string;
  now: () => number;
}) {
  const { store, audit, secret, now } = deps;

  async function issueSession(stored: StoredAccount): Promise<Session> {
    const at = now();
    const accessExpiresAt = at + ACCESS_TOKEN_TTL_MS;
    const accessToken = signAccessToken(
      {
        iss: ISSUER,
        aud: AUDIENCE,
        sub: stored.account.id,
        ver: stored.sessionVersion,
        iat: Math.floor(at / 1000),
        exp: Math.floor(accessExpiresAt / 1000),
      },
      secret,
    );
    const refreshToken = randomBytes(REFRESH_TOKEN_BYTES).toString("base64url");
    const refreshExpiresAt = at + REFRESH_TOKEN_TTL_MS;
    await store.refreshTokens.insert(randomUUID(), stored.account.id, sha256(refreshToken), at, refreshExpiresAt);
    return { accessToken, accessExpiresAt, refreshToken, refreshExpiresAt, account: stored.account };
  }

  /** Ends every session of an account at once: access tokens by `ver`, refresh tokens by revocation. */
  async function revokeAll(accountId: string): Promise<void> {
    await store.accounts.revokeSessions(accountId);
    await store.refreshTokens.revokeAll(accountId, now());
  }

  const principalOf = (a: AdminAccount): Principal => ({ accountId: a.id, username: a.username });

  return {
    revokeAll,

    async login(username: string, password: string, actor: Actor): Promise<Session> {
      const stored = await store.accounts.findByUsername(username.trim());
      const matches = await verifyPassword(password, stored?.passwordHash ?? (await decoyHash));
      if (!stored || !matches || stored.account.disabled) {
        await audit.record(actor, { action: "auth.login_failed", detail: { username: username.trim().slice(0, 254) } });
        throw new AppError(ERRORS.authInvalidCredentials);
      }
      await store.accounts.recordSignIn(stored.account.id, now());
      const fresh = (await store.accounts.find(stored.account.id)) ?? stored;
      await audit.record({ ...actor, principal: principalOf(fresh.account) }, { action: "auth.login" });
      return issueSession(fresh);
    },

    async refresh(refreshToken: string): Promise<Session> {
      const found = await store.refreshTokens.findByHash(sha256(refreshToken));
      if (!found || found.revokedAt !== null || found.expiresAt <= now()) throw new AppError(ERRORS.authRefreshInvalid);
      // A used token presented again was copied: end every session of that account.
      if (found.usedAt !== null || !(await store.refreshTokens.markUsed(found.id, now()))) {
        await revokeAll(found.accountId);
        throw new AppError(ERRORS.authRefreshInvalid);
      }
      const stored = await store.accounts.find(found.accountId);
      if (!stored || stored.account.disabled) throw new AppError(ERRORS.authRefreshInvalid);
      return issueSession(stored);
    },

    async logout(refreshToken: string, actor: Actor): Promise<{ signedOut: true }> {
      const found = await store.refreshTokens.findByHash(sha256(refreshToken));
      if (!found || found.revokedAt !== null) throw new AppError(ERRORS.authRefreshInvalid);
      await store.refreshTokens.revoke(found.id, now());
      const stored = await store.accounts.find(found.accountId);
      await audit.record({ ...actor, ...(stored && { principal: principalOf(stored.account) }) }, { action: "auth.logout" });
      return { signedOut: true };
    },

    /** The request's admin, as the token says and the account now is; refused if either disagrees. */
    async authenticate(authorization: string | undefined): Promise<Principal> {
      const token = authorization ? BEARER.exec(authorization)?.[1] : undefined;
      const claims = token ? verifyAccessToken(token, secret, now()) : undefined;
      const stored = claims ? await store.accounts.find(claims.sub) : undefined;
      if (!claims || !stored || stored.account.disabled || stored.sessionVersion !== claims.ver) {
        throw new AppError(ERRORS.authUnauthorized);
      }
      return principalOf(stored.account);
    },

    me: async (principal: Principal): Promise<AdminAccount> => {
      const stored = await store.accounts.find(principal.accountId);
      if (!stored) throw new AppError(ERRORS.authUnauthorized);
      return stored.account;
    },

    async changePassword(principal: Principal, current: string, next: string, actor: Actor): Promise<{ changed: true }> {
      const stored = await store.accounts.find(principal.accountId);
      if (!stored || !(await verifyPassword(current, stored.passwordHash))) {
        throw new AppError(ERRORS.authInvalidCredentials, { field: "currentPassword" });
      }
      const passwordHash = await hashPassword(next);
      await store.transaction(async () => {
        await store.accounts.update({ ...stored.account, passwordHash }, now());
        await revokeAll(stored.account.id);
      });
      await audit.record({ ...actor, principal }, { action: "auth.password_changed", subject: stored.account.id });
      return { changed: true };
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
