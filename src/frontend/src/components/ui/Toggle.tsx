import { cn } from '@/lib/cn'

/* A REAL SWITCH for a real boolean (owner, 2026-08-06: "why is on/off a drop
 * down? that makes no sense from a ux").
 *
 * A `<select>` over on/off costs two interactions to flip one bit — open, then
 * pick — and reads as a set of choices when it is a state. A switch flips on
 * one click and shows its state in its own position, which is why every desktop
 * settings panel uses one.
 *
 * `role="switch"` with `aria-checked` is the platform's own answer here: a
 * button element brings Enter and Space for free, and a screen reader announces
 * "on"/"off" rather than reading a list.
 *
 * Deliberately NOT a checkbox: at the rail's label-column width a checkbox has
 * no room for a label of its own, and it would sit beside `remove_background`,
 * which is NOT a boolean at all — it defaults to the string "auto" (doc 07 §3).
 * Two different things must not look like one control.
 */

export interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  /** A STATE THAT IS SHOWN, NOT SET — and it is NOT the same thing as disabled
   *  (owner, 2026-08-07: *"why is shape and image switches disabled"*).
   *
   *  `disabled` means "this could be flipped, but not right now, and here is
   *  why" — it dims, because the greying IS the message. A switch that reports a
   *  fact something else decides (the image stage always runs; the reference is
   *  in play because one is attached) is not waiting on anything and never
   *  becomes pressable, so dimming it says "come back later" about something
   *  that will never change, and makes a healthy panel look half broken.
   *
   *  So this stays at full strength, takes no clicks, and carries `aria-disabled`
   *  rather than `disabled` — a screen reader still reaches it and reads the
   *  state, which is the entire reason it is on screen. */
  readOnly?: boolean
  'aria-label': string
  title?: string
  className?: string
}

/* THE KNOB CARRIES THE STATE, NOT THE TRACK.
 *
 * Two wrong turns before this, both worth recording. First the track was
 * `--color-accent-tint` (the accent at 12%) and the knob was the dark control
 * gradient — so BOTH halves were dim and the thing read as disabled while on.
 * The fix for that overcorrected to a solid `--color-accent` track, which is a
 * loud amber slab: not this app's vocabulary at all. Doc 11 §3's idiom for
 * "on" everywhere else — the segmented chip, the toggled icon button — is a
 * RAISED element with accent edging, and the solid accent fill is reserved for
 * the one primary button on a surface.
 *
 * So the track stays the recessed groove every control sits in, picking up only
 * an accent edge and a whisper of tint, and the KNOB becomes the accent: a
 * small bright dot that has visibly travelled. State reads from the thing that
 * moved rather than from repainting the whole control. */
const TRACK =
  'relative inline-flex h-4.5 w-8 flex-none cursor-pointer items-center rounded-full border p-px ' +
  'border-ctl-edge bg-surface transition-colors duration-fade ease-linear ' +
  'focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-accent-tint)] ' +
  'aria-checked:border-accent-edge aria-checked:bg-accent-tint ' +
  'disabled:cursor-not-allowed disabled:opacity-45'

/* Off: the raised control gradient, so it reads as a thing that can move.
   On: the accent, top-lit the same way, so it is the same OBJECT relit rather
   than a different shape.
 *
 * The two fills are SELECTED, never stacked. `cn()` is a plain join with no
 * conflict resolution, so appending a second `bg-[…]` to the first leaves both
 * on the element and stylesheet order decides — which silently kept the dark
 * fill and put the accent on the track instead. Same failure the segmented
 * chips and the parameter fields each hit; in this codebase a conditional class
 * that fights a base class does nothing. */
const KNOB =
  'pointer-events-none block size-3.5 rounded-full shadow-[var(--shadow-ctl),var(--shadow-stroke-hi)] ' +
  'transition-[transform,background-color] duration-fade ease-linear'
/* OFF has to read as a knob, not as a hole (owner, 2026-08-06: "the off state
   doesnt look good"). It was `--color-ctl-hi → --color-ctl` — a dark control
   gradient on the darker `--surface` groove, so the two
   merged and the control looked empty rather than switched off. The off knob is
   now the same value the FOREGROUND text sits at, dimmed: light enough to be
   plainly a movable thing, quiet enough that "on" is still the louder state. */
const KNOB_OFF = 'bg-[linear-gradient(180deg,var(--color-muted),var(--color-faint))]'
const KNOB_ON = 'bg-[linear-gradient(180deg,var(--color-accent-strong),var(--color-accent))]'

export function Toggle({ checked, onChange, disabled = false, readOnly = false, title, className, ...rest }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      aria-disabled={readOnly || undefined}
      title={title}
      className={cn(TRACK, readOnly && 'cursor-default', className)}
      onClick={readOnly ? undefined : () => onChange(!checked)}
      {...rest}
    >
      <span className={cn(KNOB, checked ? `${KNOB_ON} translate-x-3.5` : KNOB_OFF)} />
    </button>
  )
}
