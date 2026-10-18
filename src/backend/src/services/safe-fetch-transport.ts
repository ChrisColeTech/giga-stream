import { lookup as dnsLookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import type { LookupFunction } from "node:net";
import type { Readable } from "node:stream";

import { SafeFetchError } from "./safe-fetch-error.js";
import { isBlockedAddress } from "./address-ranges.js";

export type Resolver = (
  hostname: string,
  options: { all: true; family?: number },
) => Promise<Array<{ address: string; family: 4 | 6 }>>;

/** One request to a URL that has passed the URL checks; the address check is `request.lookup`'s job. */
export interface TransportRequest {
  url: URL;
  method: "GET" | "HEAD";
  headers: Record<string, string>;
  signal: AbortSignal;
  lookup: LookupFunction;
}
export interface TransportResponse {
  status: number;
  headers: Record<string, string>;
  body: Readable;
}
export type SafeTransport = (request: TransportRequest) => Promise<TransportResponse>;

export const systemResolver: Resolver = async (hostname, options) => {
  const found = await dnsLookup(hostname, { all: true, ...(options.family ? { family: options.family } : {}) });
  return found.flatMap(({ address, family }) => (family === 4 || family === 6 ? [{ address, family }] : []));
};

/**
 * The `lookup` hook of the request: resolves the name, refuses the whole answer when ANY address is non-public
 * (a mixed answer is how rebinding is staged), and hands back a validated one. Serves both callback forms.
 */
export function createGuardedLookup(resolve: Resolver, allowLoopback: boolean): LookupFunction {
  return (hostname, options, callback) => {
    const family = options.family === 4 || options.family === 6 ? options.family : undefined;
    resolve(hostname, { all: true, ...(family ? { family } : {}) }).then(
      (list) => {
        const first = list[0];
        if (first === undefined || list.some((entry) => isBlockedAddress(entry.address, allowLoopback))) {
          callback(new SafeFetchError("safe_fetch.blocked_address", hostname), "", 0);
        } else if (options.all) {
          callback(null, list);
        } else {
          callback(null, first.address, first.family);
        }
      },
      () => callback(new SafeFetchError("safe_fetch.failed", hostname), "", 0),
    );
  };
}

function lowerHeaders(raw: http.IncomingHttpHeaders): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(raw)) {
    if (value !== undefined) out[name.toLowerCase()] = Array.isArray(value) ? value.join(", ") : value;
  }
  return out;
}

/** The real transport: `node:https` (`node:http` only for a loopback URL, which the caller has already vetted). */
export const nodeTransport: SafeTransport = (request) =>
  new Promise((resolve, reject) => {
    const { url } = request;
    const module = url.protocol === "https:" ? https : http;
    const outgoing = module.request(
      {
        hostname: url.hostname.replace(/^\[|\]$/g, ""),
        port: url.port === "" ? undefined : Number(url.port),
        path: `${url.pathname}${url.search}`,
        method: request.method,
        headers: request.headers,
        lookup: request.lookup,
        signal: request.signal,
        agent: false,
      },
      (response) =>
        resolve({ status: response.statusCode ?? 0, headers: lowerHeaders(response.headers), body: response }),
    );
    outgoing.on("error", reject);
    outgoing.end();
  });
