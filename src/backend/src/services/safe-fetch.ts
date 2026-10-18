// STUB: replaced by feat/safe-fetch at merge
// A stand-in with the final interface (docs/43 section 3.8) so the playlist code can be built and tested. The real
// function is built on `node:https` with a pinned, validated address; this one wraps the global `fetch` and enforces
// only the timeout, the abort signal and the byte caps. It must never be the version that ships.

export interface SafeFetchOptions {
  method?: "GET" | "HEAD";
  headers?: Record<string, string>;
  timeoutMs: number;
  /** A hard cap: a longer body is `safe_fetch.too_large`, never a truncation. */
  maxBytes?: number;
  /** Read only this many leading bytes and stop (`truncated` says whether more was there). */
  prefixBytes?: number;
  signal?: AbortSignal;
  maxRedirects?: number;
}

export interface SafeFetchResult {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
  url: string;
  truncated: boolean;
}

export type SafeFetch = (url: string, options: SafeFetchOptions) => Promise<SafeFetchResult>;

export type SafeFetchCode =
  | "safe_fetch.bad_url"
  | "safe_fetch.blocked_address"
  | "safe_fetch.too_many_redirects"
  | "safe_fetch.redirect_refused"
  | "safe_fetch.too_large"
  | "safe_fetch.timeout"
  | "safe_fetch.aborted"
  | "safe_fetch.failed";

export class SafeFetchError extends Error {
  readonly code: SafeFetchCode;
  readonly host: string | undefined;

  constructor(code: SafeFetchCode, host?: string) {
    super(code);
    this.name = "SafeFetchError";
    this.code = code;
    this.host = host;
  }
}

export function createSafeFetch(_deps: Record<string, unknown> = {}): SafeFetch {
  return async (url, options) => {
    let host: string | undefined;
    try {
      host = new URL(url).host;
    } catch {
      throw new SafeFetchError("safe_fetch.bad_url");
    }
    const signals = [AbortSignal.timeout(options.timeoutMs), ...(options.signal ? [options.signal] : [])];
    let response: Response;
    try {
      response = await fetch(url, {
        method: options.method ?? "GET",
        headers: options.headers,
        signal: AbortSignal.any(signals),
      });
    } catch {
      if (options.signal?.aborted) throw new SafeFetchError("safe_fetch.aborted", host);
      throw new SafeFetchError(signals[0]?.aborted ? "safe_fetch.timeout" : "safe_fetch.failed", host);
    }
    const limit = options.prefixBytes ?? options.maxBytes ?? Number.POSITIVE_INFINITY;
    const chunks: Buffer[] = [];
    let size = 0;
    let truncated = false;
    const reader = response.body?.getReader();
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
      size += value.byteLength;
      if (size > limit) {
        if (options.prefixBytes === undefined) {
          await reader.cancel();
          throw new SafeFetchError("safe_fetch.too_large", host);
        }
        truncated = true;
        await reader.cancel();
        break;
      }
    }
    const whole = Buffer.concat(chunks);
    const body = options.prefixBytes === undefined ? whole : whole.subarray(0, options.prefixBytes);
    return { status: response.status, headers: Object.fromEntries(response.headers), body, url: response.url || url, truncated };
  };
}
