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

/** The sentence that names why an address was refused. */
export function addressRefusal(field: string, allowLoopback: boolean): string {
  return allowLoopback
    ? `The ${field} must be an https address, or http on 127.0.0.1 or localhost.`
    : `The ${field} must be an https address.`;
}
