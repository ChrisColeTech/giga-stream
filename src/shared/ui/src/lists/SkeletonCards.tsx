import type { CSSProperties } from 'react'

import { cn } from '../lib/cn'
import { SHIMMER_TILE } from '../lib/shimmer'

/* Mirrors the real gallery card — thumbnail block over two caption lines — so
 * the layout is already correct when the data lands and nothing shifts
 * (doc 10 §14.2). A browser never renders a tile with a hole where the picture
 * goes (owner, 2026-08-05). The shimmer fill is the height-less `SHIMMER_TILE`
 * (lib/shimmer.ts): it shapes to its box, where a bar would bake a line height in. */

/** The zero-width space restores the line box, so each caption band stands as
 *  tall as the real text it stands in for — no magic numbers to drift. */
const LINE_BOX = "flex items-center before:content-['\\200b']"

export function SkeletonCards({ count, className, style }: { count: number; className?: string; style?: CSSProperties }) {
  return (
    <div className={cn('pointer-events-none cursor-default', className)} style={style} aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex flex-col overflow-hidden rounded-card border border-border bg-panel">
          <span className="block aspect-4/3 w-full bg-surface">
            <span className={cn(SHIMMER_TILE, 'size-full')} />
          </span>
          <span className="grid min-w-0 gap-0.75 px-2.25 py-1.75">
            <span className={cn(LINE_BOX, 'text-xs')}>
              <span className={cn(SHIMMER_TILE, 'h-[9px] w-[70%] rounded-ctl')} />
            </span>
            <span className={cn(LINE_BOX, 'text-[11px]')}>
              <span className={cn(SHIMMER_TILE, 'h-2 w-[40%] rounded-ctl')} />
            </span>
          </span>
        </div>
      ))}
    </div>
  )
}
