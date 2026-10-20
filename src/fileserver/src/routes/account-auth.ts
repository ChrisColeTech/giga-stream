import type { FastifyInstance, FastifyRequest } from "fastify";

import { AppError } from "../lib/app-error.js";
import { okEnvelope } from "../lib/envelope.js";
import { parseInput } from "../lib/parse-input.js";
import type { AppServices } from "../services/app-services.js";
import {
  LoginBody, PasswordBody, ProfilePatch, RefreshBody, RegisterBody, ResetBody, ResetStartBody,
} from "../types/account.js";
import { accountRefreshOf, clearAccountRefresh, setAccountRefresh } from "./account-cookie.js";

const invalid = { code: "account.invalid" as const, status: 422 };
const requestOf = (request: FastifyRequest) => ({
  ...(request.headers.authorization !== undefined && { authorization: request.headers.authorization }),
  address: request.ip,
});

function refreshOf(request: FastifyRequest, cookieOnly = false): string {
  const body = cookieOnly ? {} : parseInput(RefreshBody, request.body ?? {});
  const token = ("refreshToken" in body ? body.refreshToken : undefined) ?? accountRefreshOf(request);
  if (token === undefined) throw new AppError("auth.refresh_invalid", 401, "That session cannot be refreshed.");
  return token;
}

/** Account signup/session/profile/reset routes backed directly by Turso (docs/64 and docs/65 wave 1). */
export function registerAccountAuthRoutes(app: FastifyInstance, services: AppServices): void {
  app.post("/api/account/auth/register", async (request, reply) => {
    const body = parseInput(RegisterBody, request.body, invalid);
    const session = await services.accountApi.register(body, requestOf(request));
    setAccountRefresh(request, reply, session.refreshToken);
    return okEnvelope(session);
  });
  app.post("/api/account/auth/login", async (request, reply) => {
    const body = parseInput(LoginBody, request.body);
    const session = await services.accountApi.login(body.username, body.password, requestOf(request));
    setAccountRefresh(request, reply, session.refreshToken);
    return okEnvelope(session);
  });
  app.post("/api/account/auth/refresh", async (request, reply) => {
    try {
      const session = await services.accountApi.refresh(refreshOf(request));
      setAccountRefresh(request, reply, session.refreshToken);
      return okEnvelope(session);
    } catch (error) { clearAccountRefresh(request, reply); throw error; }
  });
  app.post("/api/account/auth/restore", async (request, reply) => {
    try {
      const session = await services.accountApi.refresh(refreshOf(request, true));
      setAccountRefresh(request, reply, session.refreshToken);
      return okEnvelope(session);
    } catch (error) { clearAccountRefresh(request, reply); throw error; }
  });
  app.post("/api/account/auth/logout", async (request, reply) => {
    const token = refreshOf(request);
    clearAccountRefresh(request, reply);
    return okEnvelope(await services.accountApi.logout(token, requestOf(request)));
  });
  app.post("/api/account/auth/password", async (request, reply) => {
    const body = parseInput(PasswordBody, request.body, invalid);
    const answer = await services.accountApi.password(
      body.currentPassword, body.newPassword, requestOf(request),
    );
    clearAccountRefresh(request, reply);
    return okEnvelope(answer);
  });
  app.get("/api/account/me", async (request) => {
    return okEnvelope(await services.accountApi.me(requestOf(request)));
  });
  app.patch("/api/account/me", async (request) => {
    const body = parseInput(ProfilePatch, request.body, invalid);
    return okEnvelope(await services.accountApi.username(body.username, requestOf(request)));
  });
  app.post("/api/auth/reset-start", async (request) => {
    const body = parseInput(ResetStartBody, request.body, invalid);
    return okEnvelope(await services.accountApi.resetStart(body.username));
  });
  app.post("/api/auth/reset", async (request, reply) => {
    const body = parseInput(ResetBody, request.body, invalid);
    const answer = await services.accountApi.reset(
      body.username, body.answer, body.newPassword, requestOf(request),
    );
    clearAccountRefresh(request, reply);
    return okEnvelope(answer);
  });
}
