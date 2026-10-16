import { AppError } from "./app-error.js";

/** Loopback hosts may use plain http; everything else needs TLS unless the dev override is on. */
export function isLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "localhost" || host === "[::1]" || /^127(\.\d{1,3}){3}$/.test(host);
}

/**
 * Validate and normalize the admin backend address (docs/03 section 3.2). The result has no
 * credentials, query, fragment or trailing slash. A refusal names the setting (`settings.invalid`)
 * or demands TLS (`backend.tls_required`).
 */
export function normalizeAdminUrl(raw: string, allowInsecure: boolean): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new AppError("settings.invalid", 422, "The admin address must be a full http(s) URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AppError("settings.invalid", 422, "The admin address must start with http:// or https://.");
  }
  if (url.username !== "" || url.password !== "") {
    throw new AppError("settings.invalid", 422, "The admin address must not contain a name or password.");
  }
  if (url.protocol === "http:" && !isLoopbackHost(url.hostname) && !allowInsecure) {
    throw new AppError("backend.tls_required", 422, "An admin backend off this machine must use https.");
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

/** Host and port only: a label for the UI, never credentials, path or query. */
export function adminUrlLabel(baseUrl: string): string {
  try {
    return new URL(baseUrl).host || baseUrl;
  } catch {
    return baseUrl;
  }
}
