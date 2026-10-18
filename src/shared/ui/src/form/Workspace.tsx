import type { CSSProperties, ReactNode } from 'react'

import { cn } from '../lib/cn'
import { labelColumn } from '../lib/label-column'

/* THE form and workspace grammar (doc 03 §Frontend Rules — the page grammar;
 * the Banks index is the gold standard):
 *
 *   Workspace  the scrolling stage, FULL WIDTH with 24px of page padding —
 *              no centred column, no max width.
 *   Group      an icon tile (48px, the accent gradient), a mono Title 28
 *              heading, an optional badge and trailing action; groups are
 *              separated by the accent-cored splitter the Group draws itself.
 *   Row        a Body Strong (14/600) sentence-case label in a fixed column,
 *              ONE control spanning the row, trailing icon buttons on the
 *              readout edge, an error under the control. Explanation is a
 *              `tip` (an info glyph with a real tooltip) — never hint text.
 *   NumberRow  a number in a row, the unit inside the field.
 *   Wide       a row with no label column — a tile grid, a strip, a list.
 *   Actions    the form's end: ghost actions left, ONE accent button right.
 *
 * No cards, no boxes, no full-width dividers, nothing under 12px.
 * One component per file (docs/27 step 2b): the parts live beside this file under form/. */

/** The scrolling stage. `labels` sizes the label column for every row inside. `wide` is accepted and ignored — every workspace is full width now; it stays only for pages another wave still passes it from. */
export function Workspace({
  children,
  labels = [],
  className,
  fill = false,
}: {
  children: ReactNode
  labels?: readonly string[]
  className?: string
  wide?: boolean
  /** The last group's list takes the remaining height instead of the page scrolling. */ fill?: boolean
}) {
  return (
    <div className={cn('min-h-0 flex-1 overflow-y-auto bg-surface', fill && 'flex flex-col', className)}>
      <div
        className={cn('flex w-full flex-col px-6 pb-8', fill && 'min-h-full flex-1 pb-6')}
        style={{ '--label-col': labelColumn(labels) } as CSSProperties}
      >
        {children}
      </div>
    </div>
  )
}
