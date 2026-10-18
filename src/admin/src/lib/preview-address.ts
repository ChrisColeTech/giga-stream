import type { AdminChannel } from "@/types/admin-channel";

/** An address the backend built from the caller's origin, taken as its path on the page's own origin, so the request is
 *  same-origin (the Vite proxy in development, the backend itself in production) and never depends on CORS. An address
 *  that does not parse is kept as it is. */
export function pathOf(address: string): string {
  try {
    return new URL(address).pathname;
  } catch {
    return address;
  }
}

/** What the Preview plays (`36` section 8): a live channel its own `/live/<id>/master.m3u8` path; a stream channel its
 *  `streamUrl` as answered (an external address; a refusal by that origin is the player's honest error). */
export const previewAddress = (channel: AdminChannel): string =>
  channel.kind === "live" ? pathOf(channel.streamUrl) : channel.streamUrl;

/** A live row's logo is the backend's `/logos/<id>.png`, read on the page's own origin; a stream row's is its own. */
export function logoAddress(channel: AdminChannel): string | undefined {
  if (channel.logoUrl === undefined) return undefined;
  return channel.kind === "live" ? pathOf(channel.logoUrl) : channel.logoUrl;
}
