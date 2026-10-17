import { SHIMMER } from "@/constants/skeleton";
import { cn } from "@/lib/cn";
import { RELATED_SKELETON_COUNT } from "@/lib/player-copy";

/** The related band's loading and empty treatment (`06` section 5.5): eight thumbnail skeletons in the Studio
 *  rail's own frame (`ThumbnailRailSkeleton`), so the band keeps its shape when the titles arrive. */
export function RelatedSkeleton() {
  return (
    <div className="h-full bg-panel">
      <div className="pointer-events-none flex h-full items-stretch gap-1.5 overflow-hidden px-2.5 py-1.5" aria-hidden>
        {Array.from({ length: RELATED_SKELETON_COUNT }, (_, index) => (
          <span
            key={index}
            className="block aspect-4/3 h-full flex-none overflow-hidden rounded-ctl border border-border bg-surface"
          >
            <span className={cn(SHIMMER, "size-full")} />
          </span>
        ))}
      </div>
    </div>
  );
}
