import { cn } from '../lib/cn'
import { SHIMMER } from '../lib/shimmer'

/** The line box of a split list's skeleton row (the same zero-width space the other skeletons use). */
const LINE_BOX = "before:content-['\\200b']"

/** A split list's waiting column: `count` rows of the real row's height, a tick slot when the column is multi-select. */
export function SplitSkeleton({ count, tick = true }: { count: number; tick?: boolean }) {
  return (
    <div className="pointer-events-none" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex h-9 items-center gap-2.5 px-3">
          {tick && <span className="size-3.5 flex-none rounded-[3px] border border-hair" />}
          <span className={cn('min-w-0 flex-1 text-sm', LINE_BOX)}>
            <span className={cn(SHIMMER, 'h-[9px] rounded-ctl')} style={{ width: `${45 + ((i * 37) % 40)}%` }} />
          </span>
          <span className={cn(SHIMMER, 'h-[9px] w-6 rounded-ctl')} />
        </div>
      ))}
    </div>
  )
}
