import { readFileSync } from "node:fs";

import type { Config } from "./config.js";
import { JWT_SECRET_MIN } from "./constants/limits.js";

const LOOPBACK = new Set(["127.0.0.1", "::1", "localhost"]);

export const isLoopbackHost = (host: string): boolean => LOOPBACK.has(host);

/**
 * Why the backend must not start with these settings (docs/03 sections 7.10 and 7.12), or undefined.
 * Checked before any database file is created.
 */
export function startRefusal(settings: Config): string | undefined {
  if (settings.JWT_SECRET.length < JWT_SECRET_MIN) {
    return `JWT_SECRET must be set to at least ${JWT_SECRET_MIN} characters: it signs every access token.`;
  }
  const cert = settings.TLS_CERT_FILE !== "";
  const key = settings.TLS_KEY_FILE !== "";
  if (cert !== key) return "TLS_CERT_FILE and TLS_KEY_FILE must be set together.";
  if (!isLoopbackHost(settings.HOST) && !cert && !settings.TRUST_PROXY && !settings.ALLOW_INSECURE_HTTP) {
    return (
      `Refusing to listen on ${settings.HOST} over plain http: passwords and tokens would cross the network ` +
      "in clear. Set TLS_CERT_FILE and TLS_KEY_FILE, or TRUST_PROXY=true behind a TLS-terminating proxy, or " +
      "ALLOW_INSECURE_HTTP=true for development on a trusted network only."
    );
  }
  return undefined;
}

/** The certificate and key the backend serves `https` and `wss` with, when configured. */
export function tlsOptions(settings: Config): { cert: Buffer; key: Buffer } | undefined {
  if (settings.TLS_CERT_FILE === "") return undefined;
  return { cert: readFileSync(settings.TLS_CERT_FILE), key: readFileSync(settings.TLS_KEY_FILE) };
}

/** `CORS_ORIGINS` as a list; empty means no browser page on another origin may call the backend. */
export const corsOrigins = (settings: Config): string[] =>
  settings.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean);

/** Routes whose answers must never be cached: they carry tokens or account details. */
export const isPrivateRoute = (url: string): boolean =>
  /^\/api\/(auth|admin-accounts|audit)(\/|\?|$)/.test(url);
