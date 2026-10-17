import { SHIMMER_TILE as SHIMMER } from "@giga/ui/lib/shimmer";
import { cn } from "@giga/ui/lib/cn";

/** Matches the recommendation image and caption geometry without inventing title text. */
export function RelatedSkeleton() {
  return (
    <div className="pointer-events-none flex h-full items-stretch gap-1.5 overflow-hidden px-2.5 py-1.5" aria-hidden>
      {Array.from({ length: 14 }, (_, index) => (
        <span key={index} className="flex h-full flex-none flex-col overflow-hidden rounded-ctl border border-border bg-surface">
          <span className="block aspect-4/3 h-[calc(100%-1.75rem)] flex-none">
            <span className={cn(SHIMMER, "size-full")} />
          </span>
          <span className="flex h-7 w-0 min-w-full flex-none items-center px-2">
            <span className={cn(SHIMMER, "h-2 w-3/4 rounded-ctl")} />
          </span>
        </span>
      ))}
    </div>
  );
}
