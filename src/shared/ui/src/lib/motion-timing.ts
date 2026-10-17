/* The whole motion and timing vocabulary, in the units each consumer needs (merged from the interface's motion.ts and
 * timing.ts by docs/27 step 3; the two had the same ease, and the interface used only one of the two EASE_IN names). The
 * CSS side of the durations lives in tokens.css's @theme. These MUST stay in step with it: a duration that disagreed
 * would desynchronise a JS tween from the CSS transition running beside it. Framer Motion takes seconds and a
 * cubic-bezier array, not a token string, which is why both units exist here. */

/** Fades between colour/border states. */
export const DUR_FADE_MS = 70;
/** Explicit point-to-point shell motion: pane collapse and reopen. */
export const DUR_FAST_MS = 140;
/** Rail accordion sections. Quicker than `DUR_FAST_MS` (owner, 2026-08-06: "the collapse should be faster"): a
 *  workspace pane is moved deliberately and rarely, while a rail section gets flicked open and shut while hunting for a
 *  control, and at 140ms that reads as waiting for the panel. */
export const DUR_COLLAPSE_MS = 100;
/** The events drawer. */
export const DUR_MOVE_MS = 200;
/** Overlay entrances. */
export const DUR_PAGE_MS = 280;

/** A collapse tween in seconds: state commits at once, the paint travels this long. The family's value (Giga Cut owner
 *  ruling, 2026-09-30: 0.14 s felt a tad slow). */
export const COLLAPSE_S = 0.1;

/** cubic-bezier(0.55, 0.55, 0, 1): point-to-point. */
export const EASE_P2P = [0.55, 0.55, 0, 1] as const;
/** cubic-bezier(0, 0, 0, 1): entrances and the drawer (the deceleration ease, `--ease-in`). */
export const EASE_OUT = [0, 0, 0, 1] as const;

/** The follow-the-OS media query that the "system" motion preference resolves through. */
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** How long an armed two-step waits for its second press before it disarms (`01` section 9). */
export const TWO_STEP_MS = 4000;
