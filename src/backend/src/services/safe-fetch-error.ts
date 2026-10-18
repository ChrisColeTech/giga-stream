export type SafeFetchCode =
  | "safe_fetch.bad_url"
  | "safe_fetch.blocked_address"
  | "safe_fetch.too_many_redirects"
  | "safe_fetch.redirect_refused"
  | "safe_fetch.too_large"
  | "safe_fetch.timeout"
  | "safe_fetch.aborted"
  | "safe_fetch.failed";

/** A guarded outbound request failed. Carries the host only: never the URL, the query or an upstream message. */
export class SafeFetchError extends Error {
  readonly code: SafeFetchCode;
  readonly host?: string;

  constructor(code: SafeFetchCode, host?: string) {
    super(code);
    this.name = "SafeFetchError";
    this.code = code;
    if (host !== undefined) this.host = host;
  }
}
