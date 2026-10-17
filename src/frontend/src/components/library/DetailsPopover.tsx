import { Star } from "lucide-react";
import { PopupPanel } from "@/components/popups/PopupPanel";
import { NAME_CHIP } from "@/components/ui/name-chip";
import { SHIMMER } from "@/components/ui/SkeletonRows";
import { cn } from "@/lib/cn";
import { detailFacts, ratingOutOfTen } from "@/lib/card-details";
import type { ResolvedItem } from "@/lib/library-marks";
import { useTitleDetail } from "@/hooks/useTitleDetail";

export interface DetailsPopoverProps {
  readonly item: ResolvedItem;
  readonly anchor: HTMLElement;
  readonly onClose: () => void;
  /** True for the glyph that opened it, so pressing the glyph again is not an outside press. */
  readonly belongs: (node: Node) => boolean;
}

/** A title's details, hung from its card's Details glyph (`06` section 4.2): rating, then year, kind and runtime, the
 *  genres as name chips and the plot's opening lines. The card already knows the rating and genres; the kind line,
 *  runtime and plot come from the title's detail and are shimmer lines until it is read. */
export function DetailsPopover({ item, anchor, onClose, belongs }: DetailsPopoverProps) {
  const { detail, pending } = useTitleDetail(item.ref.id);
  /* The card's own rating, never the detail's: TMDB's list and detail answers differ, and the badge must agree. */
  const rating = ratingOutOfTen(item.rating);
  const genres = detail?.genres ?? item.genres;
  const facts = detailFacts(item, detail);

  return (
    <PopupPanel title={item.title} size="compact" policy="live" anchor={anchor} onClose={onClose} related={belongs}>
      <div className="flex flex-col gap-2" aria-busy={pending}>
        {rating !== undefined && (
          <span className="inline-flex items-center gap-1.5 font-mono text-sm text-text">
            <Star className="size-3.5 text-muted" fill="currentColor" aria-hidden />
            {rating}
          </span>
        )}
        {pending ? (
          <span className={cn(SHIMMER, "w-[60%]")} />
        ) : (
          <span className="font-mono text-xs text-muted">{facts.join(" · ")}</span>
        )}
        {genres.length > 0 && (
          <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0" aria-label="Genres">
            {genres.map((name) => (
              <li key={name} className={NAME_CHIP}>
                {name}
              </li>
            ))}
          </ul>
        )}
        {pending && (
          <div className="flex flex-col gap-2">
            <span className={cn(SHIMMER, "w-[95%]")} />
            <span className={cn(SHIMMER, "w-[88%]")} />
            <span className={cn(SHIMMER, "w-[70%]")} />
          </div>
        )}
        {detail?.plot !== undefined && <p className="m-0 line-clamp-4 text-xs leading-5 text-muted">{detail.plot}</p>}
      </div>
    </PopupPanel>
  );
}
