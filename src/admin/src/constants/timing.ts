/** Motion timing, the whole vocabulary in one place. The eases mirror `--ease-*` in index.css and the durations
 *  its `--duration-*`; framer-motion takes the same numbers as cubic-bezier arrays. */

/** A collapse tween: state commits at once, the paint travels this long (seconds). The family's own value
 *  (Giga Cut owner ruling, 2026-09-30: 0.14 s felt a tad slow). */
export const COLLAPSE_S = 0.1;

/** A section folding open or shut (seconds): the family's rail accordion, Giga LoRA Studio's DUR_COLLAPSE_MS. */
export const SECTION_FOLD_S = 0.1;

/** The point-to-point ease (`--ease-p2p`). */
export const EASE_P2P = [0.55, 0.55, 0, 1] as const;

/** The deceleration ease (`--ease-in`) for entrances. */
export const EASE_OUT = [0, 0, 0, 1] as const;

/** The follow-the-OS media query that "system" motion resolves through. */
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
