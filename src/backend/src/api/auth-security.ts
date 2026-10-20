import type { FastifyInstance } from "fastify";

import { ERRORS } from "../constants/errors.js";
import type { Services } from "../services/service-registry.js";
import { ResetSchema, ResetStartSchema } from "../types/security-question.js";
import { ok } from "./envelope.js";
import { actorOf } from "./guard.js";
import { parseInput } from "./parse-input.js";
import { accountRefreshCookie, adminRefreshCookie } from "./refresh-cookie.js";

/**
 * The password reset by security question (docs/40 section 2.4). Both routes are under `/api/auth`, the
 * documented public prefix: the reset belongs to the account, not to the console's session, and it
 * serves both kinds. Every answer carries `Cache-Control: no-store`. A body that fails its schema is
 * `422 account.invalid` naming the field, before any lookup or count. Setting a question moved to the
 * admin route `PUT /api/admin/accounts/:accountId/security-question` (docs/54 section 2).
 */
export function registerAuthSecurity(app: FastifyInstance, services: Services): void {
  app.post("/reset-start", async (request, reply) => {
    const { username } = parseInput(ResetStartSchema, request.body, ERRORS.accountInvalid);
    return ok(reply, await services.securityQuestions.start(username));
  });

  app.post("/reset", async (request, reply) => {
    const { username, answer, newPassword } = parseInput(ResetSchema, request.body, ERRORS.accountInvalid);
    const done = await services.securityQuestions.reset(username, answer, newPassword, actorOf(request));
    // The reset ended every session of the account, admin or user: both cookie scopes go with it, so
    // whichever program asked holds no token its next refresh would refuse (docs/62 section 3.2).
    reply.header("set-cookie", [adminRefreshCookie.clearHeader(request), accountRefreshCookie.clearHeader(request)]);
    return ok(reply, done);
  });
}
