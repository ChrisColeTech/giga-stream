import { isIPv4, isIPv6 } from "node:net";

function v4Number(text: string): number {
  return text.split(".").reduce((sum, part) => sum * 256 + Number(part), 0);
}

/** Loopback (127/8), `0.0.0.0` and link-local (169.254/16): the only IPv4 addresses refused (docs/43 section 3.8). */
function blockedV4(value: number, allowLoopback: boolean): boolean {
  if (Math.floor(value / 2 ** 24) === 127) return !allowLoopback;
  return value === 0 || Math.floor(value / 2 ** 16) === 169 * 256 + 254;
}

/** The eight 16-bit groups of an IPv6 text address, or null. Handles `::` and a dotted IPv4 tail. */
function v6Groups(text: string): number[] | null {
  let rest = text.split("%")[0] ?? "";
  const cut = rest.lastIndexOf(":");
  const tail = rest.slice(cut + 1);
  if (tail.includes(".")) {
    if (!isIPv4(tail)) return null;
    const n = v4Number(tail);
    rest = `${rest.slice(0, cut + 1)}${Math.floor(n / 65536).toString(16)}:${(n % 65536).toString(16)}`;
  }
  const halves = rest.split("::");
  if (halves.length > 2) return null;
  const listOf = (half: string | undefined): string[] => (half ? half.split(":") : []);
  const head = listOf(halves[0]);
  const end = halves.length === 2 ? listOf(halves[1]) : [];
  const fill = 8 - head.length - end.length;
  if (halves.length === 2 ? fill < 1 : fill !== 0) return null;
  const all = [...head, ...Array<string>(halves.length === 2 ? fill : 0).fill("0"), ...end];
  if (!all.every((group) => /^[0-9a-f]{1,4}$/i.test(group))) return null;
  return all.map((group) => parseInt(group, 16));
}

/** `::`, `::1`, link-local `fe80::/10`, and an IPv4-mapped form judged by the IPv4 inside it. */
function blockedV6(g: number[], allowLoopback: boolean): boolean {
  const at = (i: number): number => g[i] ?? 0;
  if (g.slice(0, 7).every((x) => x === 0)) return at(7) === 1 ? !allowLoopback : at(7) === 0;
  if (g.slice(0, 5).every((x) => x === 0) && at(5) === 0xffff) return blockedV4(at(6) * 65536 + at(7), false);
  return (at(0) & 0xffc0) === 0xfe80;
}

/**
 * True when `address` (an IP literal) must not be connected to: loopback or link-local, nothing more (private LAN
 * addresses are allowed). Anything that is not a parseable IP literal is blocked. `allowLoopback` (a test seam of
 * `createSafeFetch`, never a setting) admits 127/8 and `::1`, but not an IPv4-mapped form.
 */
export function isBlockedAddress(address: string, allowLoopback = false): boolean {
  if (isIPv4(address)) return blockedV4(v4Number(address), allowLoopback);
  if (isIPv6(address)) {
    const groups = v6Groups(address);
    return groups === null || blockedV6(groups, allowLoopback);
  }
  return true;
}
