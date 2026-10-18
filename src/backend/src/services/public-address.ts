import { isIP } from "node:net";

/**
 * Whether a host written as an IP literal is a public address (docs/03 section 7.3). A name is not judged here: the
 * guarded fetch resolves it and judges the answer. This is the part of the rule an address can fail on its own
 * text, so a private literal never becomes a stored channel or playlist address.
 */

/** IPv4 ranges that are not public: [first address as a number, prefix length]. */
const IPV4_REFUSED: ReadonlyArray<readonly [string, number]> = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
];

const BYTE_MAX = 255;
const QUAD_BITS = 32;
const IPV6_GROUPS = 8;

function ipv4Number(text: string): number {
  return text.split(".").reduce((sum, part) => sum * 256 + Number(part), 0);
}

function isPublicIpv4(text: string): boolean {
  const value = ipv4Number(text);
  return !IPV4_REFUSED.some(([first, bits]) => {
    const size = 2 ** (QUAD_BITS - bits);
    return Math.floor(value / size) === Math.floor(ipv4Number(first) / size);
  });
}

/** The eight 16-bit groups of an IPv6 literal, or undefined when it does not parse. */
function ipv6Groups(text: string): number[] | undefined {
  let rest = text;
  const tail = /(\d+\.\d+\.\d+\.\d+)$/.exec(rest)?.[1];
  if (tail !== undefined) {
    const n = ipv4Number(tail);
    rest = `${rest.slice(0, -tail.length)}${Math.floor(n / 65536).toString(16)}:${(n % 65536).toString(16)}`;
  }
  const halves = rest.split("::");
  if (halves.length > 2) return undefined;
  const side = (part: string | undefined): number[] =>
    part === undefined || part === "" ? [] : part.split(":").map((group) => parseInt(group, 16));
  const head = side(halves[0]);
  const back = side(halves[1]);
  const gap = IPV6_GROUPS - head.length - back.length;
  const groups = halves.length === 2 ? [...head, ...new Array<number>(Math.max(gap, 0)).fill(0), ...back] : head;
  return groups.length === IPV6_GROUPS && groups.every((group) => Number.isInteger(group)) ? groups : undefined;
}

const embeddedIpv4 = (high: number, low: number): string =>
  `${Math.floor(high / 256)}.${high % 256}.${Math.floor(low / 256)}.${low % 256}`;

function isPublicIpv6(text: string): boolean {
  const g = ipv6Groups(text);
  if (g === undefined) return false;
  const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0, high = 0, low = 0] = g;
  if (g.every((group) => group === 0)) return false; // ::
  if (g.slice(0, 7).every((group) => group === 0) && f === 0 && low === 1) return false; // ::1
  if ([a, b, c, d, e].every((group) => group === 0) && f === 0xffff) return isPublicIpv4(embeddedIpv4(high, low)); // mapped
  if (a === 0x64 && b === 0xff9b) return false; // NAT64
  if (a === 0x2002) return isPublicIpv4(embeddedIpv4(b, c)); // 6to4
  if (a === 0x2001 && (b === 0 || b === 0xdb8)) return false; // Teredo, documentation
  if ((a & 0xfe00) === 0xfc00) return false; // unique local
  if ((a & 0xffc0) === 0xfe80 || (a & 0xffc0) === 0xfec0) return false; // link-local, site-local
  return (a & 0xff00) !== 0xff00; // multicast
}

/** Loopback as a literal or the name `localhost`: the one thing `ALLOW_LOOPBACK_STREAMS` lets through. */
export function isLoopbackHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return host === "localhost" || host.endsWith(".localhost") || host === "::1" || /^127\.\d+\.\d+\.\d+$/.test(host);
}

/** Whether `hostname` (as `URL.hostname` writes it) may be fetched from the backend's network position. */
export function isPublicHost(hostname: string, allowLoopback: boolean): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (allowLoopback && isLoopbackHost(host)) return true;
  if (isLoopbackHost(host)) return false;
  const kind = isIP(host);
  if (kind === 4) return host.split(".").every((part) => Number(part) <= BYTE_MAX) && isPublicIpv4(host);
  if (kind === 6) return isPublicIpv6(host);
  return true;
}
