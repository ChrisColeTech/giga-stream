import { cn } from "@giga/ui/lib/cn";
import { SHIMMER, SHIMMER_TILE } from "@giga/ui/lib/shimmer";
import { PosterImage } from "@/components/ui/PosterImage";
import { useTitleDetail } from "@/hooks/useTitleDetail";
import { ratingOutOfTen } from "@/lib/card-details";
import { LIBRARY_COPY } from "@/lib/library-copy";
import { spotlightFacts } from "@/lib/spotlight-state";
import type { LibraryItem } from "@/types/library";

const FRAME = "flex min-w-0 gap-4 p-4";

/** The preview of a title being read: the poster slot and lines in the shape the preview lands in. */
function PreviewSkeleton() {
  return (
    <div className={cn(FRAME, "pointer-events-none")} aria-hidden>
      <span className={cn(SHIMMER_TILE, "block aspect-[2/3] w-32 flex-none rounded-card")} />
      <div className="flex min-w-0 flex-1 flex-col gap-3 pt-1">
        <span className={cn(SHIMMER, "w-[70%]")} />
        <span className={cn(SHIMMER, "w-[34%]")} />
        <span className={cn(SHIMMER, "w-[52%]")} />
        <span className={cn(SHIMMER, "w-full")} />
        <span className={cn(SHIMMER, "w-[88%]")} />
      </div>
    </div>
  );
}

/** What the list read already carries (poster, title, year, kind, genres, rating) is shown at once; the plot comes
 *  from the title's detail, the read the Details popover makes, and is a shimmer line until it lands. */
function PreviewBody({ item }: { readonly item: LibraryItem }) {
  const { detail, pending } = useTitleDetail(item.ref.id);
  const rating = ratingOutOfTen(item.rating);
  const genres = item.genres.length > 0 ? item.genres : (detail?.genres ?? []);
  return (
    <div className={FRAME} data-preview>
      <span className="block w-32 flex-none">
        <PosterImage src={item.posterUrl} alt={item.title} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-1">
        <span className="text-lg leading-tight font-semibold text-text">{item.title}</span>
        <span className="font-mono text-xs text-dim">
          {spotlightFacts(item, { movie: LIBRARY_COPY.movie, series: LIBRARY_COPY.series })}
        </span>
        {genres.length > 0 && <span className="text-sm text-muted">{genres.join(" · ")}</span>}
        {rating !== undefined && <span className="font-mono text-sm text-text">{rating}</span>}
        {detail?.plot !== undefined && detail.plot !== "" && (
          <span className="mt-1 line-clamp-5 text-sm leading-snug text-muted">{detail.plot}</span>
        )}
        {pending && (
          <div className="mt-1 flex flex-col gap-2.5" aria-hidden>
            <span className={cn(SHIMMER, "w-full")} />
            <span className={cn(SHIMMER, "w-[80%]")} />
          </div>
        )}
      </div>
    </div>
  );
}

/** The preview pane of Search titles (`06` section 4.6), the right column of the results: the focused title's poster,
 *  name, `year · kind`, genres, rating and the opening of its plot. Informational only, no buttons: Play and Info live
 *  on the rows. With no row to preview it is the skeleton. */
export function SpotlightPreview({ item }: { readonly item: LibraryItem | undefined }) {
  return item === undefined ? <PreviewSkeleton /> : <PreviewBody key={item.ref.id} item={item} />;
}
