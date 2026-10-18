import { useMemo } from "react";
import { deletedSpec } from "@/lib/list-specs";
import { deletedRow, type DeletedRowView } from "@/lib/title-restore";
import { useAppStore } from "@/store/app-store";
import { useListQuery, type ListQueryView } from "./useListQuery";

const idOf = (row: DeletedRowView): string => row.id;

function retain(keep: (id: string) => boolean): void {
  const state = useAppStore.getState();
  state.titlesDeletedSetTicked(state.titles.deleted.ticked.filter(keep));
}

/** The Deleted titles list as the query shows it: every deleted title's row, searched and filtered by kind, in the
 *  backend's order (`lib/list-query.ts`). */
export function useDeletedView(): ListQueryView<DeletedRowView> {
  const items = useAppStore((state) => state.titles.deleted.items);
  const rows = useMemo(() => items.map(deletedRow), [items]);
  return useListQuery({ list: "deleted", rows, spec: deletedSpec, idOf, retain });
}
