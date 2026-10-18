import { isIP } from "node:net";
import type { Readable } from "node:stream";

import { SAFE_FETCH_MAX_REDIRECTS, SAFE_FETCH_USER_AGENT } from "../constants/limits.js";
import { isBlockedAddress } from "./address-ranges.js";
import { SafeFetchError, type SafeFetchCode } from "./safe-fetch-error.js";
import {
  createGuardedLookup,
  nodeTransport,
  systemResolver,
  type Resolver,
  type SafeTransport,
} from "./safe-fetch-transport.js";

export { SafeFetchError, type SafeFetchCode } from "./safe-fetch-error.js";
export type { SafeTransport, TransportRequest, TransportResponse } from "./safe-fetch-transport.js";

/**
 * The one guarded outbound function (docs/43 section 3.8; docs/03 section 7.3): https only, no userinfo, every
 * address checked at connect time by the lookup hook, redirects followed by hand and re-checked, bytes counted
 * while streaming. Errors carry the host only.
 */
export interface SafeFetchOptions {
  method?: "GET" | "HEAD";
  headers?: Record<string, string>;
  timeoutMs: number;
  maxBytes?: number;
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
export interface SafeFetchDeps {
  lookup?: Resolver;
  transport?: SafeTransport;
  allowLoopback?: boolean;
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
const FORCED_HEADERS = new Set(["host", "accept-encoding", "user-agent", "connection", "cookie", "cookie2"]);
const CROSS_HOST_DROPPED = new Set(["authorization", "proxy-authorization"]);

function checkUrl(url: URL, allowLoopback: boolean, refusal: SafeFetchCode): void {
  const host = url.host;
  const loopbackOk = allowLoopback && LOOPBACK_HOSTS.has(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopbackOk)) throw new SafeFetchError(refusal, host);
  if (url.username !== "" || url.password !== "" || url.hostname === "") throw new SafeFetchError(refusal, host);
  const literal = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(literal) !== 0 && isBlockedAddress(literal, allowLoopback)) {
    throw new SafeFetchError("safe_fetch.blocked_address", host);
  }
}

function requestHeaders(extra: Record<string, string> | undefined, crossHost: boolean): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(extra ?? {})) {
    const key = name.toLowerCase();
    if (!FORCED_HEADERS.has(key) && !(crossHost && CROSS_HOST_DROPPED.has(key))) headers[name] = value;
  }
  return { ...headers, "Accept-Encoding": "identity", Connection: "close", "User-Agent": SAFE_FETCH_USER_AGENT };
}

/** Reads the body, counting decoded bytes; destroys the stream at the cap, at the prefix and on abort. */
function readBody(
  stream: Readable,
  signal: AbortSignal,
  maxBytes: number | undefined,
  prefix: number | undefined,
  host: string,
): Promise<{ body: Buffer; truncated: boolean }> {
  return new Promise<{ body: Buffer; truncated: boolean }>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let settled = false;
    const settle = (finish: () => void): void => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", onAbort);
      stream.destroy();
      finish();
    };
    const onAbort = (): void => settle(() => reject(new Error("aborted")));
    if (signal.aborted) return onAbort();
    signal.addEventListener("abort", onAbort, { once: true });
    stream.on("data", (chunk: Buffer) => {
      if (maxBytes !== undefined && total + chunk.length > maxBytes) {
        return settle(() => reject(new SafeFetchError("safe_fetch.too_large", host)));
      }
      const room = prefix === undefined ? chunk.length : Math.min(chunk.length, prefix - total);
      chunks.push(room === chunk.length ? chunk : chunk.subarray(0, room));
      total += room;
      if (prefix !== undefined && total >= prefix) {
        settle(() => resolve({ body: Buffer.concat(chunks), truncated: true }));
      }
    });
    stream.on("end", () => settle(() => resolve({ body: Buffer.concat(chunks), truncated: false })));
    stream.on("error", () => settle(() => reject(new Error("stream"))));
    stream.on("close", () => settle(() => reject(new Error("closed early"))));
  });
}

export function createSafeFetch(deps: SafeFetchDeps = {}): SafeFetch {
  const allowLoopback = deps.allowLoopback === true;
  const transport = deps.transport ?? nodeTransport;
  const lookup = createGuardedLookup(deps.lookup ?? systemResolver, allowLoopback);

  return async (rawUrl, options) => {
    let current: URL;
    try {
      current = new URL(rawUrl);
    } catch {
      throw new SafeFetchError("safe_fetch.bad_url");
    }
    const first = current;
    if ((options.maxBytes === undefined) === (options.prefixBytes === undefined)) {
      throw new SafeFetchError("safe_fetch.failed", first.host);
    }
    const method = options.method ?? "GET";
    const maxRedirects = options.maxRedirects ?? SAFE_FETCH_MAX_REDIRECTS;
    const control = new AbortController();
    let why: "safe_fetch.timeout" | "safe_fetch.aborted" | undefined;
    const stop = (reason: NonNullable<typeof why>): void => {
      why ??= reason;
      control.abort();
    };
    const timer = setTimeout(() => stop("safe_fetch.timeout"), options.timeoutMs);
    const onAbort = (): void => stop("safe_fetch.aborted");
    if (options.signal?.aborted) onAbort();
    else options.signal?.addEventListener("abort", onAbort, { once: true });

    try {
      for (let hop = 0; ; hop++) {
        checkUrl(current, allowLoopback, hop === 0 ? "safe_fetch.bad_url" : "safe_fetch.redirect_refused");
        if (control.signal.aborted) throw new SafeFetchError(why ?? "safe_fetch.failed", current.host);
        const headers = requestHeaders(options.headers, current.host !== first.host);
        const response = await transport({ url: current, method, headers, signal: control.signal, lookup });
        const location = response.headers["location"];
        if (REDIRECT_STATUSES.has(response.status) && location !== undefined && location !== "") {
          response.body.destroy();
          if (hop >= maxRedirects) throw new SafeFetchError("safe_fetch.too_many_redirects", current.host);
          try {
            current = new URL(location, current);
          } catch {
            throw new SafeFetchError("safe_fetch.redirect_refused", current.host);
          }
          continue;
        }
        const names = Object.entries(response.headers).map(([k, v]) => [k.toLowerCase(), v] as const);
        const read =
          method === "HEAD"
            ? (response.body.destroy(), { body: Buffer.alloc(0), truncated: false })
            : await readBody(response.body, control.signal, options.maxBytes, options.prefixBytes, current.host);
        return { status: response.status, headers: Object.fromEntries(names), url: current.href, ...read };
      }
    } catch (error) {
      if (error instanceof SafeFetchError) throw error;
      throw new SafeFetchError(why ?? "safe_fetch.failed", current.host);
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onAbort);
    }
  };
}
