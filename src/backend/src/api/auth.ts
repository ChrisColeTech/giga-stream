import type { FastifyInstance } from "fastify";

import type { Services } from "../services/service-registry.js";
import { LoginSchema, PasswordChangeSchema, RefreshSchema } from "../types/account.js";
import { ok } from "./envelope.js";
import { actorOf, signedIn } from "./guard.js";
import { parseInput } from "./parse-input.js";

/** Sign-in and tokens (docs/03 section 7.12). */
export function registerAuth(app: FastifyInstance, services: Services): void {
  app.post("/api/auth/login", async (request, reply) => {
    const { email, password } = parseInput(LoginSchema, request.body);
    return ok(reply, await services.auth.login(email, password, actorOf(request)));
  });

  app.post("/api/auth/refresh", async (request, reply) => {
    const { refreshToken } = parseInput(RefreshSchema, request.body);
    return ok(reply, services.auth.refresh(refreshToken));
  });

  app.post("/api/auth/logout", async (request, reply) => {
    const { refreshToken } = parseInput(RefreshSchema, request.body);
    return ok(reply, services.auth.logout(refreshToken, actorOf(request)));
  });

  app.get("/api/auth/me", async (request, reply) => {
    const principal = signedIn(services, request);
    return ok(reply, services.auth.me(principal));
  });

  app.post("/api/auth/password", async (request, reply) => {
    const principal = signedIn(services, request);
    const { currentPassword, newPassword } = parseInput(PasswordChangeSchema, request.body);
    return ok(reply, await services.auth.changePassword(principal, currentPassword, newPassword, actorOf(request, principal)));
  });
}
