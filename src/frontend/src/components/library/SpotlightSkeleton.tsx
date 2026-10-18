import { cn } from "@giga/ui/lib/cn";
import { SHIMMER, SHIMMER_TILE } from "@giga/ui/lib/shimmer";

/** The spotlight's waiting and empty list (`06` section 4.6): compact rows in the result row's own shape (the 28x42
 *  poster slot, one line of title and facts), so nothing shifts when the results land. No sentence. */
export function SpotlightSkeleton({ count }: { readonly count: number }) {
  return (
    <div className="pointer-events-none flex cursor-default flex-col" aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex h-11 flex-none items-center gap-3 px-2">
          <span className="block h-10.5 w-7 flex-none overflow-hidden rounded-ctl">
            <span className={cn(SHIMMER_TILE, "size-full")} />
          </span>
          <span className={cn(SHIMMER, "w-[42%]")} />
          <span className={cn(SHIMMER, "w-[14%]")} />
        </div>
      ))}
    </div>
  );
}
