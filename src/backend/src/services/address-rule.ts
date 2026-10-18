import { isIP } from "node:net";

import { isBlockedAddress } from "./address-ranges.js";

/** `localhost` and its subdomains: names that resolve to loopback, so only `ALLOW_LOOPBACK_STREAMS` admits them. */
const isLoopbackName = (host: string): boolean => host === "localhost" || host.endsWith(".localhost");

/** An IP literal must be public (loopback only when allowed); a name is judged where it is fetched, bar loopback names. */
function isPublicHost(hostname: string, allowLoopback: boolean): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (isIP(host) !== 0) return !isBlockedAddress(host, allowLoopback);
  return allowLoopback || !isLoopbackName(host);
}

/**
 * The address rule of docs/03 section 7.3: a stream or image address must be `https`, carry no credentials and not be
 * a private, loopback, link-local or otherwise non-public IP literal. With `ALLOW_LOOPBACK_STREAMS`, plain `http`
 * on exactly `127.0.0.1` or `localhost` (any port) and loopback over `https` are also accepted; that is how
 * development points at the streaming test server. Nothing else is. (A name that resolves to a private address is
 * refused where it is fetched, by the guarded fetch.)
 */
export function isAcceptedAddress(value: string, allowLoopback: boolean): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.username !== "" || url.password !== "" || url.hostname === "") return false;
  if (!isPublicHost(url.hostname, allowLoopback)) return false;
  if (url.protocol === "https:") return true;
  const loopback = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  return allowLoopback && url.protocol === "http:" && loopback;
}

/** The sentence that names why an address was refused. */
export function addressRefusal(field: string, allowLoopback: boolean): string {
  return allowLoopback
    ? `The ${field} must be a public https address, or http on 127.0.0.1 or localhost.`
    : `The ${field} must be a public https address.`;
}
