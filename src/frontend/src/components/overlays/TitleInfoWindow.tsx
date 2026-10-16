import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/Button";
import { PosterImage } from "@/components/ui/PosterImage";
import { Skeleton } from "@/components/ui/Skeleton";
import { workSpec } from "@/constants/child-window";
import { LIBRARY_ITEMS, TITLE_DETAILS } from "@/fixtures/titles";
import type { LibraryItem } from "@/types/library";
import type { TitleDetail } from "@/types/title";
import { ChildWindow } from "./ChildWindow";

const SPEC = workSpec("title-info", "Title information");

/** Title information: a work window (`06` section 4.4) opened by a card's Info. It reads the item the store names and
 *  draws the item's detail; until the detail is read, its text bands are skeletons. Favourite and Collections apply at
 *  once when they can, so there is no footer. */
export function TitleInfoWindow() {
  const closeOverlay = useAppStore((state) => state.closeOverlay);
  const itemRef = useAppStore((state) => state.overlayItem);
  const item: LibraryItem | undefined = LIBRARY_ITEMS.find(
    (candidate) => candidate.ref.kind === itemRef?.kind && candidate.ref.id === itemRef?.id,
  );
  const detail: TitleDetail | undefined = itemRef?.kind === "title" ? TITLE_DETAILS[itemRef.id] : undefined;

  return (
    <ChildWindow spec={SPEC} onClose={closeOverlay}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex min-h-0 min-w-0 flex-1 gap-4 overflow-y-auto p-3">
          <div className="w-[180px] flex-none">
            <PosterImage alt={item?.title ?? "Title"} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {item === undefined ? (
              <Skeleton className="h-4" style={{ width: "60%" }} />
            ) : (
              <h3 className="m-0 font-sans text-base font-semibold text-text">{item.title}</h3>
            )}
            <p className="m-0 font-mono text-[11px] text-dim">
              {item === undefined ? "" : [item.year, item.kind === "tv" ? "Series" : item.kind === "movie" ? "Movie" : "Local file", item.quality].filter(Boolean).join(" · ")}
            </p>
            {detail === undefined ? (
              <div className="flex flex-col gap-2">
                <Skeleton style={{ width: "95%" }} />
                <Skeleton style={{ width: "88%" }} />
                <Skeleton style={{ width: "70%" }} />
              </div>
            ) : (
              <p className="m-0 font-sans text-xs leading-relaxed text-muted">{detail.plot}</p>
            )}
            {detail !== undefined && (
              <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                {detail.cast.map((name) => (
                  <li key={name} className="rounded-ctl border border-hair bg-surface px-2 py-0.5 font-sans text-[11px] text-muted">
                    {name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="flex h-10 flex-none items-center justify-between gap-2 border-t border-hair px-3">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" disabled title="Available once the library is connected.">
              Favourite
            </Button>
            <Button size="sm" variant="ghost" disabled title="Available once the library is connected.">
              Collections
            </Button>
          </div>
          <Button size="sm" variant="primary" disabled title="Playing arrives with the Player.">
            Play
          </Button>
        </div>
      </div>
    </ChildWindow>
  );
}
