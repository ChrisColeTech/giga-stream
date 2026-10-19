import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { ERRORS } from "../constants/errors.js";
import type { Services } from "../services/service-registry.js";
import { AccountCreateSchema, AccountPatchSchema } from "../types/account.js";
import { AccountSecurityQuestionSchema } from "../types/security-question.js";
import { ok } from "./envelope.js";
import { actorOf, signedIn } from "./guard.js";
import { parseInput } from "./parse-input.js";
import { clearRefreshCookie } from "./refresh-cookie.js";

const AccountParams = z.object({ accountId: z.string().min(1).max(200) });

/** Admin accounts (docs/03 section 7.11): any signed-in admin. */
export function registerAccounts(app: FastifyInstance, services: Services): void {
  app.get("/api/admin-accounts", async (request, reply) => {
    signedIn(services, request);
    return ok(reply, services.accounts.list());
  });

  app.get("/api/admin-accounts/:accountId", async (request, reply) => {
    signedIn(services, request);
    const { accountId } = parseInput(AccountParams, request.params);
    return ok(reply, services.accounts.get(accountId));
  });

  app.post("/api/admin-accounts", async (request, reply) => {
    const principal = signedIn(services, request);
    const input = parseInput(AccountCreateSchema, request.body, ERRORS.accountInvalid);
    return ok(reply, await services.accounts.create(input, actorOf(request, principal)), 201);
  });

  app.patch("/api/admin-accounts/:accountId", async (request, reply) => {
    const principal = signedIn(services, request);
    const { accountId } = parseInput(AccountParams, request.params);
    const patch = parseInput(AccountPatchSchema, request.body, ERRORS.accountInvalid);
    const saved = await services.accounts.update(accountId, patch, actorOf(request, principal));
    // Changing the caller's own password or disabling it revokes the caller's sessions: the cookie goes with them.
    if (accountId === principal.accountId && (patch.password !== undefined || patch.disabled !== undefined)) {
      clearRefreshCookie(request, reply);
    }
    return ok(reply, saved);
  });

  app.delete("/api/admin-accounts/:accountId", async (request, reply) => {
    const principal = signedIn(services, request);
    const { accountId } = parseInput(AccountParams, request.params);
    return ok(reply, services.accounts.remove(accountId, actorOf(request, principal)));
  });

  // Setting a question is an admin acting on a selected account (docs/54 section 2): no current password, and
  // changing it ends no session, so the refresh cookie stays.
  app.put("/api/admin-accounts/:accountId/security-question", async (request, reply) => {
    const principal = signedIn(services, request);
    const { accountId } = parseInput(AccountParams, request.params);
    const body = parseInput(AccountSecurityQuestionSchema, request.body, ERRORS.accountInvalid);
    const done = await services.securityQuestions.setFor(accountId, body.question, body.answer, actorOf(request, principal));
    return ok(reply, done);
  });
}
