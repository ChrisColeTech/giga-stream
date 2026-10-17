/* THE ACCENT BAR (handoff §20.5, owner: "the green dots are lazy and low quality… they should be using the nano style
 * actionlist accent strips"): state on a row is a 4px rounded bar on its LEFT EDGE, never a dot. One ramp for the
 * ActionList's rows and a settings Row alike — the ActionList imports these classes; a Row takes `accent=`. */
export type Accent = 'none' | 'success' | 'error' | 'warning' | 'inactive'
export const ACCENT: Record<Accent, string> = {
  none: '',
  success: 'bg-st-done',
  error: 'bg-st-failed',
  warning: 'bg-sw-amber',
  inactive: 'bg-dim/40',
}

/* Label: Body Strong (14/600), sentence case, in the text font. Control: 36px, body 14, and it SPANS THE ROW — one width for every control in a form. */
export const FIELD_LABEL = 'flex w-[var(--label-col,140px)] flex-none items-center gap-1.5 text-sm leading-5 font-semibold text-text'
export const FIELD_ROW = 'flex items-center gap-3'
/* `!` because Input's own height/padding/size sit in the same layer and would win on order. */
export const FIELD_CONTROL = 'h-9! w-full min-w-0 flex-1 px-3! text-sm! leading-5'
