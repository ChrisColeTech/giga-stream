/**
 * The address rule of docs/03 section 7.3: a stream or image address must be `https`. With
 * `ALLOW_LOOPBACK_STREAMS`, plain `http` on exactly `127.0.0.1` or `localhost` (any port) is also
 * accepted; that is how development points at the streaming test server. Nothing else is, and no
 * address may carry credentials.
 */
export function isAcceptedAddress(value: string, allowLoopback: boolean): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.username !== "" || url.password !== "") return false;
  if (url.protocol === "https:") return url.hostname !== "";
  const loopback = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  return allowLoopback && url.protocol === "http:" && loopback;
}

/**
 * An address as the store keeps and answers it: its scheme, host and path only. The query string, the fragment and any
 * credentials go, since a playlist's tokens travel in them (docs/29 section 18). Nothing is refused for this.
 */
export function withoutQuery(value: string): string {
  return value.replace(/[?#].*$/s, "").replace(/^([a-z][a-z0-9+.-]*:\/\/)[^/@]*@/i, "$1");
}

/** A refusal example, `<name> (<address>)`, with its address made by `withoutQuery`; other text is left whole. */
export function refusalWithoutQuery(example: string): string {
  const open = example.lastIndexOf(" (");
  if (open < 0 || !example.endsWith(")")) return withoutQuery(example);
  return `${example.slice(0, open)} (${withoutQuery(example.slice(open + 2, -1))})`;
}

/** The sentence that names why an address was refused. */
export function addressRefusal(field: string, allowLoopback: boolean): string {
  return allowLoopback
    ? `The ${field} must be an https address, or http on 127.0.0.1 or localhost.`
    : `The ${field} must be an https address.`;
}
