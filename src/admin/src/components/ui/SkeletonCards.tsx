import { cn } from '@giga/ui/lib/cn'

/* Mirrors the real gallery card — thumbnail block over two caption lines — so
 * the layout is already correct when the data lands and nothing shifts
 * (doc 10 §14.2). A browser never renders a tile with a hole where the picture
 * goes (owner, 2026-08-05). */

/** The height-less shimmer fill (SkeletonRows' export bakes a line height in;
 *  this one shapes to its box). Exported for tile-shaped skeletons. */
export const SHIMMER =
  'block bg-[length:200%_100%] animate-skel-shimmer ' + 'bg-[linear-gradient(100deg,var(--color-hair)_30%,var(--color-border)_50%,var(--color-hair)_70%)]'

/** The zero-width space restores the line box, so each caption band stands as
 *  tall as the real text it stands in for — no magic numbers to drift. */
const LINE_BOX = "flex items-center before:content-['\\200b']"

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

/** A thumbnail rail's full row of skeletons — the viewer filmstrip and the
 *  rig/animate bottom rails all wear exactly this. The shape is the REAL
 *  thumb's (owner, 2026-08-06, corrected twice): a full-height 4:3 picture
 *  tile — the strip is pictures, so no caption bands (the gallery-card
 *  anatomy depicted content that never renders in a rail), and no pinned
 *  width (`w-24` was an accident inherited from a 104px strip that turned
 *  taller rails into half-empty portrait slivers). Empty rail and filled
 *  rail share identical geometry, which is the whole point of a skeleton. */
export function ThumbnailRailSkeleton() {
  return (
    <div className="pointer-events-none flex h-full items-stretch gap-1.5 overflow-hidden px-2.5 py-1.5" aria-hidden>
      {Array.from({ length: 14 }, (_, index) => (
        <span key={index} className="block aspect-4/3 h-full flex-none overflow-hidden rounded-ctl border border-border bg-surface">
          <span className={cn(SHIMMER, 'size-full')} />
        </span>
      ))}
    </div>
  )
}

export function SkeletonCards({ count, className, style }: { count: number; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={cn('pointer-events-none cursor-default', className)} style={style} aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex flex-col overflow-hidden rounded-card border border-border bg-panel">
          <span className="block aspect-4/3 w-full bg-surface">
            <span className={cn(SHIMMER, 'size-full')} />
          </span>
          <span className="grid min-w-0 gap-0.75 px-2.25 py-1.75">
            <span className={cn(LINE_BOX, 'text-xs')}>
              <span className={cn(SHIMMER, 'h-[9px] w-[70%] rounded-ctl')} />
            </span>
            <span className={cn(LINE_BOX, 'text-[11px]')}>
              <span className={cn(SHIMMER, 'h-2 w-[40%] rounded-ctl')} />
            </span>
          </span>
        </div>
      ))}
    </div>
  )
}
