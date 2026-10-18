/**
 * The address rule of docs/03 section 7.3: a stream, logo or playlist address is `http` or `https` and carries no
 * credentials (owner, 2026-10-18). Nothing else is judged here: a host that resolves to loopback or link-local is
 * refused where the backend fetches it, by the guarded fetch.
 */
export function isAcceptedAddress(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  return url.username === "" && url.password === "" && url.hostname !== "";
}

/** The sentence that names why an address was refused. */
export function addressRefusal(field: string): string {
  return `The ${field} must be an http or https address with no credentials.`;
}
