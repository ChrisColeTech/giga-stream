import { cn } from '@/lib/cn'

/* Every waiting OR empty region wears these (owner, 2026-08-06: "skeletons
 * everywhere for the empty states, and remove the text labels" — `StateLine`
 * and `HeroEmpty` are deleted; which regions keep skeletons gets established
 * next). Doc 10 §14.2's coming-vs-empty split is superseded for now.
 *
 * The markup MIRRORS the real queue row, THUMBNAIL BLOCK INCLUDED: a 4:3 slot
 * in a 56px column, then a status pip over a primary line and a faint meta
 * line. That is the whole point — the layout is already correct when the data
 * lands, so nothing shifts. A skeleton whose height does not match the row it
 * precedes CAUSES the jump it exists to prevent, so this file and
 * `generate/QueueRow.tsx` change together, always. */

/** The shimmer block itself. Exported because the real queue row wears it too:
 *  a thumbnail slot with a picture on the way is a shimmer, and a slot with no
 *  picture is a glyph — two different facts that must not render the same
 *  (doc 03 §Loading and Empty). One definition, so the skeleton and the row it
 *  stands in for cannot drift apart. */
export const SHIMMER =
  'block h-[9px] rounded-ctl bg-[length:200%_100%] animate-skel-shimmer ' +
  'bg-[linear-gradient(100deg,var(--color-hair)_30%,var(--color-border)_50%,var(--color-hair)_70%)]'

/** A shimmer block is shorter than the text it stands in for, so a row built
 *  only from blocks lands shorter than the real row and everything jumps when
 *  the data arrives — the one thing a skeleton exists to prevent. A zero-width
 *  space restores the line box: invisible, and it carries the real element's
 *  own font metrics, so there is no magic number to drift. */
const LINE_BOX = "before:content-['\\200b']"

export function SkeletonRows({ count, className }: { count: number; className?: string }) {
  return (
    <div className={cn('pointer-events-none cursor-default', className)} aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="grid grid-cols-[56px_minmax(0,1fr)] items-start gap-x-2.5 border-b border-hair px-2.75 py-2">
          <span className="block aspect-4/3 w-full overflow-hidden rounded-ctl border border-hair">
            <span className={cn(SHIMMER, 'h-full w-full rounded-none')} />
          </span>
          <span className="grid gap-1.25">
            <span className="flex items-center gap-1.75">
              <span className="size-[7px] flex-none rounded-full bg-hair" />
              <span className={cn('min-w-0 flex-1 text-xs', LINE_BOX)}>
                <span className={cn(SHIMMER, 'w-[70%]')} />
              </span>
            </span>
            <span className={cn('block text-xs', LINE_BOX)}>
              <span className={cn(SHIMMER, 'h-2 w-[45%]')} />
            </span>
          </span>
        </div>
      ))}
    </div>
  )
}
