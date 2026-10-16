/**
 * The name backstop beside Ghostery's lists (owner, 2026-10-16; docs/14 section 2.3): a host is never
 * contacted when any dot-separated part of its name starts with `ad`, or its name contains `ads`.
 * Applied as Chromium host-resolver rules, so a blocked name never resolves and nothing connects to it
 * from any frame or worker.
 */
const LABEL_PREFIXES = ["ad"];
const CONTAINS = ["ads"];

export function adHostResolverRules(): string {
  return [
    ...CONTAINS.map((part) => `MAP *${part}* ~NOTFOUND`),
    ...LABEL_PREFIXES.flatMap((prefix) => [`MAP ${prefix}* ~NOTFOUND`, `MAP *.${prefix}* ~NOTFOUND`]),
  ].join(", ");
}
