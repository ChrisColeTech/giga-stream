import type { SwatchOption } from "./Swatches";

/** The family's five accents. The interface's `Accent` type is the same set. */
export type AccentId = "amber" | "blue" | "green" | "violet" | "rose";

/** The family's display order: amber, blue, green, violet, rose. Each swatch wears its own family's fill. */
export const ACCENT_SWATCHES: readonly SwatchOption<AccentId>[] = [
  { id: "amber", fill: "bg-sw-amber" },
  { id: "blue", fill: "bg-sw-blue" },
  { id: "green", fill: "bg-sw-green" },
  { id: "violet", fill: "bg-sw-violet" },
  { id: "rose", fill: "bg-sw-rose" },
];
