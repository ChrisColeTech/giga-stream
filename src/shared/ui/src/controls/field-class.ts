/* Focus adds a 2px accent-tinted RING, not just a border swap (doc 11 §3) —
 * a border colour change alone is easy to miss on a dark surface at 1px.
 * Disabled dims and says so, so a param row the model does not declare reads
 * disabled rather than merely inert (rule 16).
 *
 * The class string the field controls share, without a height: a `Textarea`
 * layers `h-auto` over this, the single-line fields take `FIELD`. */

export const FIELD_BASE =
  'w-full rounded-ctl border border-border bg-surface px-2 font-[inherit] text-[13px] text-text ' +
  'outline-none transition-[border-color,box-shadow] duration-fade ease-linear ' +
  'focus:border-accent focus:shadow-[0_0_0_2px_var(--color-accent-tint)] placeholder:text-dim ' +
  'disabled:cursor-not-allowed disabled:opacity-45'

/* The one-line height comes last so a `Textarea` never composes this string: the generated stylesheet emits
 * `.h-ctl-md` after `.h-auto`, so a fixed height layered under `h-auto` would win the cascade (doc 53 §1). */
export const FIELD = `${FIELD_BASE} h-ctl-md`
