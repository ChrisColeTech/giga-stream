/* The whole motion vocabulary, in the units each consumer needs. The CSS side
 * of these same values lives in index.css's @theme; this file exists because
 * Framer Motion takes seconds and a cubic-bezier array, not a token string
 * (doc 03 §Theming). These MUST stay in step with the @theme block — a
 * duration that disagreed would desynchronise a JS tween from the CSS
 * transition running beside it. Tightened per doc 11 §1. */

/** Fades between colour/border states. */
export const DUR_FADE_MS = 70
/** Explicit point-to-point shell motion — pane collapse and reopen. */
export const DUR_FAST_MS = 140
/** Rail accordion sections. Quicker than `DUR_FAST_MS` (owner, 2026-08-06: "the
 *  collapse should be faster"): a workspace pane is moved deliberately and
 *  rarely, while a rail section gets flicked open and shut while hunting for a
 *  control, and at 140ms that reads as waiting for the panel. */
export const DUR_COLLAPSE_MS = 100
/** The events drawer. */
export const DUR_MOVE_MS = 200
/** Overlay entrances and the gate's lift. */
export const DUR_PAGE_MS = 280

/** cubic-bezier(0.55, 0.55, 0, 1) — point-to-point. */
export const EASE_P2P = [0.55, 0.55, 0, 1] as const
/** cubic-bezier(0, 0, 0, 1) — entrances and the drawer. */
export const EASE_IN = [0, 0, 0, 1] as const

/** How long the gate holds on "Signed in" before it lifts (E45). */
export const GATE_BEAT_MS = 900
