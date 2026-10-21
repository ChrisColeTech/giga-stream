import { SHIMMER, SHIMMER_TILE } from "@giga/ui/lib/shimmer";
import { cn } from "@giga/ui/lib/cn";

/** The loading state keeps Title information's catalog geometry instead of substituting generic form rows. */
export function TitleInfoSkeleton() {
  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4 pt-5" aria-label="Title information" aria-busy="true">
      <div className="flex items-center gap-3">
        <span className={cn(SHIMMER_TILE, "size-12 flex-none rounded-xl")} aria-hidden />
        <span className={cn(SHIMMER, "h-9 w-56 max-w-[55%]")} aria-hidden />
      </div>
      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden" data-title-info-catalog>
        <span
          className={cn(SHIMMER_TILE, "aspect-[2/3] w-[180px] flex-none self-start rounded-card")}
          data-title-info-artwork
          aria-hidden
        />
        <div
          className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto pr-1"
          data-title-info-scroll
          aria-hidden
        >
          <span className={cn(SHIMMER, "w-[72%]")} />
          <span className={cn(SHIMMER, "w-[58%]")} />
          <span className={cn(SHIMMER, "w-[66%]")} />
          <span className={cn(SHIMMER, "mt-2 w-[96%]")} />
          <span className={cn(SHIMMER, "w-[91%]")} />
          <span className={cn(SHIMMER, "w-[78%]")} />
        </div>
      </div>
    </section>
  );
}
