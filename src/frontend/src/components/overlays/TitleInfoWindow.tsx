import { FolderPlus, Play, Star } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PosterImage } from "@/components/ui/PosterImage";
import { Skeleton } from "@/components/ui/Skeleton";
import { workSpec } from "@/constants/child-window";
import { menuEventBelow, openMembershipMenu } from "@/components/library/card-menu";
import { changeFavourite, playRef } from "@/components/library/library-service";
import { TitleWatchBlock } from "@/components/library/TitleWatchBlock";
import { COLLECTION_ROWS, MEMBERSHIP } from "@/fixtures/collections";
import { LIBRARY_ITEMS, TITLE_DETAILS } from "@/fixtures/titles";
import { durationLabel, identityLine, ratingLabel, seasonsLabel } from "@/lib/library-facts";
import { LIBRARY_COPY } from "@/lib/library-copy";
import { NO_HISTORY, resolveItem, type ResolvedItem } from "@/lib/library-marks";
import { useAppStore } from "@/store/app-store";
import type { TitleDetail } from "@/types/title";
import { ChildWindow } from "./ChildWindow";

const SPEC = workSpec("title-info", "Title information", { width: 640, body: 480 });

/** Title information (`06` section 4.4): a work window opened by a card's Info. The artwork and the identity sit beside
 *  the plot, cast and runtime; the body scrolls, and the action strip stays fixed. Favorite, Collections and Play act
 *  through the fileserver, and a refusal is said on the notice line. */
export function TitleInfoWindow() {
  const closeOverlay = useAppStore((state) => state.closeOverlay);
  const ref = useAppStore((state) => state.overlayItem);
  const marks = useAppStore((state) => state.marks);
  const base = LIBRARY_ITEMS.find((candidate) => ref !== null && candidate.ref.kind === ref.kind && candidate.ref.id === ref.id);
  const item: ResolvedItem | undefined = base === undefined ? undefined : resolveItem(base, marks, NO_HISTORY, MEMBERSHIP);
  const detail: TitleDetail | undefined = ref?.kind === "title" ? TITLE_DETAILS[ref.id] : undefined;
  const progress = item?.progress;
  const local = item?.kind === "local";

  return (
    <ChildWindow spec={SPEC} onClose={closeOverlay}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="@container flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3 @min-[480px]:flex-row">
          <div className="w-[180px] flex-none">
            <PosterImage src={item?.posterUrl} alt={item?.title ?? ""} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            {item === undefined ? (
              <Skeleton className="h-4" style={{ width: "60%" }} />
            ) : (
              <h3 className="m-0 font-sans text-base font-semibold text-text">{item.title}</h3>
            )}
            {item !== undefined && <p className="m-0 font-mono text-[11px] text-dim">{identityLine(item)}</p>}
            {item !== undefined && item.genres.length > 0 && <p className="m-0 font-sans text-xs text-muted">{item.genres.join(" · ")}</p>}
            {detail !== undefined && detail.rating !== undefined && (
              <p className="m-0 font-mono text-[11px] text-dim">
                {LIBRARY_COPY.rating} {ratingLabel(detail.rating)}
              </p>
            )}
            {!local && (detail === undefined ? <PlotSkeleton /> : <Details detail={detail} />)}
            {progress !== undefined && <TitleWatchBlock progress={progress} />}
          </div>
        </div>
        <div className="flex h-10 flex-none items-center gap-2 border-t border-hair px-3">
          <Button
            size="sm"
            on={item?.favorite === true}
            aria-pressed={item?.favorite === true}
            disabled={item === undefined}
            title={item === undefined ? LIBRARY_COPY.noItem : undefined}
            onClick={() => {
              if (item !== undefined) changeFavourite(item.ref, !item.favorite);
            }}
          >
            <Star className="size-3" fill={item?.favorite === true ? "currentColor" : "none"} aria-hidden />
            {item?.favorite === true ? LIBRARY_COPY.unfavorite : LIBRARY_COPY.favorite}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={item === undefined}
            title={item === undefined ? LIBRARY_COPY.noItem : undefined}
            onClick={(event) => {
              if (item !== undefined) openMembershipMenu(menuEventBelow(event.currentTarget), item, COLLECTION_ROWS);
            }}
          >
            <FolderPlus aria-hidden /> Collections
          </Button>
          <span className="flex-1" />
          <Button
            size="sm"
            variant="primary"
            disabled={item === undefined}
            title={item === undefined ? LIBRARY_COPY.noItem : undefined}
            onClick={() => {
              if (item !== undefined) playRef(item.ref);
            }}
          >
            <Play aria-hidden /> {item?.kind === "tv" ? "Open in Player" : "Play"}
          </Button>
        </div>
      </div>
    </ChildWindow>
  );
}

/** The plot's three lines while the title's detail is not read yet. */
function PlotSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton style={{ width: "95%" }} />
      <Skeleton style={{ width: "88%" }} />
      <Skeleton style={{ width: "70%" }} />
    </div>
  );
}

/** The plot, the runtime or seasons, and the cast chips of a title's detail. */
function Details({ detail }: { readonly detail: TitleDetail }) {
  return (
    <>
      {detail.plot !== undefined && <p className="m-0 font-sans text-xs leading-relaxed text-muted">{detail.plot}</p>}
      {detail.runtimeMs !== undefined && (
        <p className="m-0 font-sans text-xs text-muted">
          <span className="text-dim">{LIBRARY_COPY.runtime}</span> {durationLabel(detail.runtimeMs)}
        </p>
      )}
      {detail.seasons !== undefined && (
        <p className="m-0 font-sans text-xs text-muted">
          <span className="text-dim">{LIBRARY_COPY.seasons}</span> {seasonsLabel(detail.seasons)}
        </p>
      )}
      {detail.cast.length > 0 && (
        <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0" aria-label={LIBRARY_COPY.cast}>
          {detail.cast.map((name) => (
            <li key={name} className="rounded-ctl border border-hair bg-surface px-2 py-0.5 font-sans text-[11px] text-muted">
              {name}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
