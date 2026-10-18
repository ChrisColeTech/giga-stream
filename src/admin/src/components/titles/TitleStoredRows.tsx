import { useCallback, useEffect } from "react";
import { WindowedRecordGrid } from "@giga/ui/lists/WindowedRecordGrid";
import { WINDOW_MIN_ROWS } from "@giga/ui/lib/window-constants";
import { TITLE_GRID, TITLE_HEADINGS } from "@/constants/title-grid";
import { useTitleActions } from "@/hooks/useTitleActions";
import { rowIn } from "@/lib/title-paged";
import { storedKey } from "@/lib/title-stored-query";
import type { AdminTitleRow } from "@/services/schemas/title-schema";
import { useAppStore } from "@/store/app-store";
import { TitleRowItem } from "./TitleRowItem";

/** The Stored list's grid (`docs/41` sections 4.2 and 5.2): `WindowedRecordGrid` over the pages the slice holds. At or
 *  under 100 rows it is the plain grid exactly as the browse list's; above, it owns its scroller, mounts the rows near
 *  the viewport and asks (by the visible range) for the pages it shows. A row whose page is not loaded is a shimmer
 *  row. When the first page is missing in the plain case (after a delete or a Refresh dropped the pages) it is read here. */
export function TitleStoredRows() {
  const { paged, selection, query, unreachable } = useAppStore((state) => state.titlesStored);
  const tick = useAppStore((state) => state.storedTick);
  const openWorkspace = useAppStore((state) => state.openWorkspace);
  const { flows, saving, isBusy, track } = useTitleActions();
  const total = paged.total ?? 0;
  const pages = paged.pages;
  const rowAtIndex = useCallback((index: number) => rowIn(pages, index), [pages]);

  /* Asked on a change of the pages or the total only, so a read that fails is not repeated in a loop. */
  useEffect(() => {
    if (total > 0 && total <= WINDOW_MIN_ROWS && pages[0] === undefined) flows.needRange(0, 0);
  }, [pages, total, flows]);

  return (
    <WindowedRecordGrid<AdminTitleRow>
      ariaLabel="Stored titles"
      layout={TITLE_GRID}
      headings={TITLE_HEADINGS}
      total={total}
      rowAt={rowAtIndex}
      idOf={(row) => row.id}
      selection={selection}
      resetKey={storedKey(query)}
      onNeedRange={flows.needRange}
      renderRow={(title, _index, ticked) => (
        <TitleRowItem
          key={title.id}
          title={title}
          ticked={ticked}
          onTick={(on) => tick(title, on)}
          onOpen={() => openWorkspace("titles", title.id)}
          onDelete={() => void track(`delete:${title.id}`, () => flows.remove(title.id))}
          busy={saving || isBusy(`delete:${title.id}`)}
          unreachable={unreachable}
        />
      )}
    />
  );
}
