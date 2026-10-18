import type { ReactNode } from 'react'

import { cn } from '../lib/cn'
import { STRIP, STRIP_MIN_H } from './strip-class'

/* THE page toolbar (LoRA Trainer components/layout/Toolbar.tsx 12-20): a thin toolbar over the family's STRIP, the
 * first child of a page's centre pane, above the scrolling column. Tools and actions LEFT, a spacer, the ONE forward
 * verb RIGHTMOST. An index holds only its forward verb on the right (DatasetsIndex.tsx 64-70); a workspace its verbs
 * left and the forward verb rightmost (DatasetWorkspace.tsx 61-72). No text labels. `Sep` is beside this file. */
export { STRIP }

export function Toolbar({ left, right, className }: { left?: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={cn(STRIP, STRIP_MIN_H, 'bg-panel', className)} role="toolbar">
      {left}
      <span className="min-w-0 flex-1" aria-hidden />
      {right}
    </div>
  )
}
