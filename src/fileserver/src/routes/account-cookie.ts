import type { FastifyReply, FastifyRequest } from "fastify";

const NAME = "giga_refresh";
const PATH = "/api/account/auth";
const MAX_AGE = 365 * 24 * 60 * 60;

const attributes = (request: FastifyRequest): string =>
  `Path=${PATH}; HttpOnly; SameSite=Strict${request.protocol === "https" ? "; Secure" : ""}`;

export function accountRefreshOf(request: FastifyRequest): string | undefined {
  for (const part of (request.headers.cookie ?? "").split(";")) {
    const at = part.indexOf("=");
    if (at > 0 && part.slice(0, at).trim() === NAME) return part.slice(at + 1).trim() || undefined;
  }
  return undefined;
}

export function setAccountRefresh(request: FastifyRequest, reply: FastifyReply, token: string): void {
  void reply.header("set-cookie", `${NAME}=${token}; Max-Age=${MAX_AGE}; ${attributes(request)}`);
}

export function clearAccountRefresh(request: FastifyRequest, reply: FastifyReply): void {
  void reply.header("set-cookie", `${NAME}=; Max-Age=0; ${attributes(request)}`);
}
