import { useCallback, useEffect } from "react";
import { isTicked } from "@giga/ui/lib/list-selection";
import { END_ACTIONS_PX, WINDOW_MIN_ROWS } from "@giga/ui/lib/window-constants";
import { RecordTable } from "@giga/ui/lists/RecordTable";
import { useTitleActions } from "@/hooks/useTitleActions";
import { useTitleRowView } from "@/hooks/useTitleRowView";
import { rowIn } from "@/lib/title-paged";
import { storedKey } from "@/lib/title-stored-query";
import type { AdminTitleRow } from "@/services/schemas/title-schema";
import { useAppStore } from "@/store/app-store";
import { titleColumns } from "./title-columns";

const idOf = (title: AdminTitleRow): string => title.id;

/** The Stored list's table (`docs/41` sections 4.2 and 5.2, `docs/45` section 2.1): a `RecordTable` over the pages the
 *  slice holds. At or under 100 rows every row is mapped; above, it mounts the rows near the viewport and asks (by the
 *  visible range) for the pages it shows. A row whose page is not loaded is a skeleton row. When the first page is
 *  missing in the mapped case (after a delete or a Refresh dropped the pages) it is read here. */
export function TitleStoredRows() {
  const { paged, selection, query, unreachable } = useAppStore((state) => state.titlesStored);
  const tick = useAppStore((state) => state.storedTick);
  const { flows } = useTitleActions();
  const rowView = useTitleRowView(unreachable);
  const total = paged.total ?? 0;
  const pages = paged.pages;
  const rowAtIndex = useCallback((index: number) => rowIn(pages, index), [pages]);

  /* Asked on a change of the pages or the total only, so a read that fails is not repeated in a loop. */
  useEffect(() => {
    if (total > 0 && total <= WINDOW_MIN_ROWS && pages[0] === undefined) flows.needRange(0, 0);
  }, [pages, total, flows]);

  return (
    <RecordTable<AdminTitleRow>
      ariaLabel="Stored titles"
      columns={titleColumns}
      paging={{ total, rowAt: rowAtIndex, resetKey: storedKey(query), onNeedRange: flows.needRange }}
      idOf={idOf}
      rowView={(title) => rowView(title, isTicked(selection, title.id), (on) => tick(title, on))}
      endPx={END_ACTIONS_PX}
    />
  );
}
