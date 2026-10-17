/* Focus adds a 2px accent-tinted RING, not just a border swap (doc 11 §3) —
 * a border colour change alone is easy to miss on a dark surface at 1px.
 * Disabled dims and says so, so a param row the model does not declare reads
 * disabled rather than merely inert (rule 16).
 *
 * The one class string the three field controls share (Input, Textarea, Select). */
export const FIELD =
  'h-ctl-md w-full rounded-ctl border border-border bg-surface px-2 font-[inherit] text-[13px] text-text ' +
  'outline-none transition-[border-color,box-shadow] duration-fade ease-linear ' +
  'focus:border-accent focus:shadow-[0_0_0_2px_var(--color-accent-tint)] placeholder:text-dim ' +
  'disabled:cursor-not-allowed disabled:opacity-45'
