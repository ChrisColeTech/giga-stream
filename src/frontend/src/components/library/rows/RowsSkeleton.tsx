import { SHIMMER as FILL } from "@/components/ui/SkeletonCards";
import { SHIMMER } from "@/components/ui/SkeletonRows";
import { cn } from "@giga/ui/lib/cn";
import { POSTER_COLUMNS, ROW_GAP, SKELETON_SHELF_CARDS, SKELETON_SHELVES } from "./rows-constants";

/** The Rows view while it has nothing to show: shelves of card skeletons in the shape of their heading and row, on the
 *  same columns as a real shelf. No sentence sits over it. */
export function RowsSkeleton() {
  return (
    <div className="flex flex-col gap-6 px-3 pt-3" aria-hidden>
      {Array.from({ length: SKELETON_SHELVES }, (_, shelf) => (
        <div key={shelf} className="flex min-w-0 flex-col gap-2.5">
          <span className={cn(SHIMMER, "w-1/4")} />
          <div className={cn("grid grid-flow-col overflow-hidden", ROW_GAP, POSTER_COLUMNS)}>
            {Array.from({ length: SKELETON_SHELF_CARDS }, (_, card) => (
              <div key={card} className="flex min-w-0 flex-col gap-1.5">
                <span className="block aspect-[2/3] w-full overflow-hidden rounded-card border border-border bg-surface">
                  <span className={cn(FILL, "size-full")} />
                </span>
                <span className={cn(SHIMMER, "w-[80%]")} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
