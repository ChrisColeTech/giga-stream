import { cn } from '../lib/cn'
import { SHIMMER_TILE } from '../lib/shimmer'

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
          <span className={cn(SHIMMER_TILE, 'size-full')} />
        </span>
      ))}
    </div>
  )
}
