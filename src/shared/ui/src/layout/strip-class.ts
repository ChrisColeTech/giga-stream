/* THE strip (LoRA Trainer components/media/HandoffStrip.tsx 8): one line, the controls `gap-2`, `px-3 py-2`, a
 * hairline under it. The page toolbar and a list's first row (`TableStrip`) are both drawn on it. */
export const STRIP = 'flex flex-none flex-wrap items-center gap-2 border-b border-hair px-3 py-2'

/* The page toolbar's height with one small button: the small control (`--spacing-ctl-sm`), the strip's `py-2` twice
 * and its 1px hairline (border-box). An EMPTY toolbar (the Jobs and Accounts indexes) keeps this height, so a page
 * does not jump between tabs. */
export const STRIP_MIN_H = 'min-h-[calc(var(--spacing-ctl-sm)_+_2*0.5rem_+_1px)]'
