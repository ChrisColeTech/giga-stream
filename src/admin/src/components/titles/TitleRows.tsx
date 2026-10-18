import { useMemo } from "react";
import { RecordTable } from "@giga/ui/lists/RecordTable";
import { useTitleBrowseRowView } from "@/hooks/useTitleBrowseRowView";
import type { TitleAdd } from "@/hooks/useTitleAdd";
import type { AdminTitleRow } from "@/services/schemas/title-schema";
import { useAppStore } from "@/store/app-store";
import { titleBrowseColumns } from "./title-browse-columns";

const idOf = (title: AdminTitleRow): string => title.id;

/** The TMDB browse list's table (`37` section 4.2, the `Browse TMDB` view): a row per title in TMDB's order, each with
 *  its `stored` / `deleted` word (dimmed) and its own `Add`. Skeleton rows in the same columns while nothing is read,
 *  while a read fails with no rows (no TMDB token) and when there is nothing to list; never a sentence. A TMDB page is 40
 *  rows at most, so every row is mapped. */
export function TitleRows({ add }: { readonly add: TitleAdd }) {
  const { status, items, ticked, unreachable, session } = useAppStore((state) => state.titles);
  const serial = useAppStore((state) => state.serial);
  const tick = useAppStore((state) => state.titleTick);
  const rowView = useTitleBrowseRowView(add, unreachable);
  const waiting = items.length === 0 || status === "idle" || session !== serial;
  const rows = useMemo(() => [...items], [items]);

  return (
    <RecordTable
      ariaLabel="Titles"
      columns={titleBrowseColumns}
      rows={rows}
      idOf={idOf}
      rowView={(title) => rowView(title, ticked.includes(title.id), (on) => tick(title.id, on))}
      waiting={waiting}
    />
  );
}
