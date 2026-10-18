import { RecordGrid } from "@giga/ui/lists/RecordGrid";
import { SkeletonGrid } from "@giga/ui/lists/SkeletonGrid";
import { TITLE_GRID, TITLE_HEADINGS } from "@/constants/title-grid";
import { useTitleActions } from "@/hooks/useTitleActions";
import { useAppStore } from "@/store/app-store";
import { TitleRowItem } from "./TitleRowItem";

/** The TMDB browse list's grid (`37` section 4.2, the `Browse TMDB` view): the header, then a row per title in TMDB's
 *  order (`TitleRowItem`). Shimmer rows while nothing is read, while a read fails with no rows (no TMDB token) and when
 *  there is nothing to list; never a sentence. A TMDB page is 40 rows at most, so it is the plain grid. */
export function TitleRows() {
  const { status, items, ticked, unreachable, session } = useAppStore((state) => state.titles);
  const serial = useAppStore((state) => state.serial);
  const tick = useAppStore((state) => state.titleTick);
  const openWorkspace = useAppStore((state) => state.openWorkspace);
  const { flows, saving, isBusy, track } = useTitleActions();
  const waiting = items.length === 0 || status === "idle" || session !== serial;

  return (
    <RecordGrid ariaLabel="Titles" layout={TITLE_GRID} headings={TITLE_HEADINGS} ticks>
      {waiting ? (
        <SkeletonGrid />
      ) : (
        items.map((title) => (
          <TitleRowItem
            key={title.id}
            title={title}
            ticked={ticked.includes(title.id)}
            onTick={(on) => tick(title.id, on)}
            onOpen={() => openWorkspace("titles", title.id)}
            onDelete={() => void track(`delete:${title.id}`, () => flows.remove(title.id))}
            busy={saving || isBusy(`delete:${title.id}`)}
            unreachable={unreachable}
          />
        ))
      )}
    </RecordGrid>
  );
}
