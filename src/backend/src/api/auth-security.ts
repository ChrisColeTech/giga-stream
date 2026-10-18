import type { FastifyInstance } from "fastify";

import { ERRORS } from "../constants/errors.js";
import type { Services } from "../services/service-registry.js";
import { ResetSchema, ResetStartSchema, SecurityQuestionSetSchema } from "../types/security-question.js";
import { ok } from "./envelope.js";
import { actorOf, signedIn } from "./guard.js";
import { parseInput } from "./parse-input.js";

/**
 * The password reset by security question (docs/40 section 3.3). All three are under `/api/auth`, so every answer
 * carries `Cache-Control: no-store`. A body that fails its schema is `422 account.invalid` naming the field, before
 * any lookup or count.
 */
export function registerAuthSecurity(app: FastifyInstance, services: Services): void {
  app.put("/api/auth/me/security-question", async (request, reply) => {
    const principal = signedIn(services, request);
    const body = parseInput(SecurityQuestionSetSchema, request.body, ERRORS.accountInvalid);
    const actor = actorOf(request, principal);
    return ok(reply, await services.securityQuestions.set(principal, body.currentPassword, body.question, body.answer, actor));
  });

  app.post("/api/auth/reset-start", async (request, reply) => {
    const { email } = parseInput(ResetStartSchema, request.body, ERRORS.accountInvalid);
    return ok(reply, services.securityQuestions.start(email, actorOf(request)));
  });

  app.post("/api/auth/reset", async (request, reply) => {
    const { email, answer, newPassword } = parseInput(ResetSchema, request.body, ERRORS.accountInvalid);
    return ok(reply, await services.securityQuestions.reset(email, answer, newPassword, actorOf(request)));
  });
}
