import { SkeletonCards } from './SkeletonCards'

/** A 240px rail's browser-in-waiting: two columns of the card skeleton
 *  (owner, 2026-08-06 — the rig/animate left browsers wear card grids).
 *  Lives beside the primitive so pages and the shell share one shape. */
export function BrowserSkeleton() {
  return (
    <div className="min-h-0 flex-1 overflow-hidden">
      <SkeletonCards count={10} className="grid grid-cols-2 gap-2 p-2" />
    </div>
  )
}
