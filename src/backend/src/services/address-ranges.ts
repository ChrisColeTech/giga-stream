import { isIPv4, isIPv6 } from "node:net";

/** The refused IPv4 ranges (docs/43 section 3.8): [base address, prefix length]. 255.255.255.255 is inside 240/4. */
const BLOCKED_V4: ReadonlyArray<readonly [string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];
const LOOPBACK_V4: readonly [string, number] = ["127.0.0.0", 8];

function v4Number(text: string): number {
  return text.split(".").reduce((sum, part) => sum * 256 + Number(part), 0);
}

function inRange(value: number, [base, prefix]: readonly [string, number]): boolean {
  const size = 2 ** (32 - prefix);
  return Math.floor(value / size) === Math.floor(v4Number(base) / size);
}

function blockedV4(value: number, allowLoopback: boolean): boolean {
  if (inRange(value, LOOPBACK_V4)) return !allowLoopback;
  return BLOCKED_V4.some((range) => inRange(value, range));
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

function blockedV6(g: number[], allowLoopback: boolean): boolean {
  const at = (i: number): number => g[i] ?? 0;
  const embedded = (hi: number, lo: number): number => at(hi) * 65536 + at(lo);
  if (g.slice(0, 7).every((x) => x === 0)) return at(7) === 1 ? !allowLoopback : true; // :: , ::1, ::a.b.c.d
  if (g.slice(0, 5).every((x) => x === 0) && at(5) === 0xffff) return blockedV4(embedded(6, 7), false);
  if (at(0) === 0x64 && at(1) === 0xff9b) {
    return g.slice(2, 6).every((x) => x === 0) ? blockedV4(embedded(6, 7), false) : true;
  }
  if (at(0) === 0x2002) return blockedV4(embedded(1, 2), false);
  if (at(0) === 0x2001 && (at(1) === 0 || at(1) === 0xdb8)) return true; // Teredo, documentation
  if (at(0) === 0x100 && g.slice(1, 4).every((x) => x === 0)) return true; // discard-only
  const first = at(0);
  const ula = (first & 0xfe00) === 0xfc00;
  const linkOrSite = (first & 0xffc0) === 0xfe80 || (first & 0xffc0) === 0xfec0;
  return ula || linkOrSite || (first & 0xff00) === 0xff00;
}

/**
 * True when `address` (an IP literal) must not be connected to. `allowLoopback` permits only 127.0.0.0/8 and ::1.
 * Anything that is not a parseable IP literal is blocked.
 */
export function isBlockedAddress(address: string, allowLoopback = false): boolean {
  if (isIPv4(address)) return blockedV4(v4Number(address), allowLoopback);
  if (isIPv6(address)) {
    const groups = v6Groups(address);
    return groups === null || blockedV6(groups, allowLoopback);
  }
  return true;
}
