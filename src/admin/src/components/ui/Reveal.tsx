import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/* THE HAND-OFF FROM SKELETON TO CONTENT (doc 03 §Loading and Empty). A
 * region that is waiting shows its skeleton — the same height as the
 * content it stands in for — and when the data lands the content FADES IN
 * over the skeleton's footprint. No region grows from zero, nothing slides:
 * opacity is the only property that animates (owner, 2026-09-05: "things
 * pop in and out and grow from 0 height to full height … animate it better
 * or hydrate it better so things dont clip into place"). `minHeight` is the
 * floor both states share when the skeleton cannot know the content's
 * exact height. */
export function Reveal({
  ready,
  skeleton,
  minHeight,
  className,
  children,
}: {
  ready: boolean
  skeleton: ReactNode
  minHeight?: number
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('relative', className)} style={minHeight === undefined ? undefined : { minHeight }} aria-busy={!ready}>
      {ready ? <div className="animate-fade-in">{children}</div> : skeleton}
    </div>
  )
}
