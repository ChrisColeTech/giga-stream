import { Trash2 } from "lucide-react";
import { Button } from "@giga/ui/controls/Button";
import { RecordTable } from "@giga/ui/lists/RecordTable";
import type { RecordRowView } from "@giga/ui/lists/record-table-types";
import { TableStrip } from "@giga/ui/lists/TableStrip";
import { ListGroup } from "@/components/records/ListGroup";
import { ListQueryBar } from "@/components/records/ListQueryBar";
import { LIST_BARS } from "@/constants/list-query-copy";
import { DELETED_TITLES, LOADING_REASON, RESTORE_TITLE } from "@/constants/title-copy";
import { useDeletedTitles } from "@/hooks/useDeletedTitles";
import { useDeletedView } from "@/hooks/useDeletedView";
import { useTitleActions } from "@/hooks/useTitleActions";
import { tickState } from "@/lib/list-query";
import type { DeletedRowView } from "@/lib/title-restore";
import { useAppStore } from "@/store/app-store";
import { deletedTitleColumns } from "./deleted-title-columns";

const idOf = (row: DeletedRowView): string => row.id;

/** `Deleted titles` (`37` section 4.4): the synced titles that were deleted and stay deleted, the name first, then the
 *  kind and when. A bounded table under the Stored list (`45` section 2.4): as tall as its rows up to ten, then it scrolls
 *  inside itself. Its selection toolbar (`01` section 9) holds `Refresh`, the bulk `Restore` (always drawn, disabled
 *  with its reason until a row is ticked) and the three-state `All`; each row ends with its own `Restore`. Skeleton rows
 *  while the list is read and while it is empty; never a sentence. */
export function DeletedTitlesGroup() {
  const { status, items, ticked } = useAppStore((state) => state.titles.deleted);
  const session = useAppStore((state) => state.titles.session);
  const serial = useAppStore((state) => state.serial);
  const tick = useAppStore((state) => state.titleDeletedTick);
  const setTicked = useAppStore((state) => state.titlesDeletedSetTicked);
  const { flows, track } = useTitleActions();
  const { verbs, row } = useDeletedTitles();
  const view = useDeletedView();
  const waiting = items.length === 0 || status === "idle" || session !== serial;
  const all = {
    label: "Select all deleted titles",
    checked: tickState(view.visible.map(idOf), ticked),
    onToggle: (on: boolean) => setTicked(on ? view.visible.map(idOf) : []),
    disabled: view.visible.length === 0,
  };

  const strip = (
    <TableStrip
      label="Deleted titles table"
      noun="deleted titles"
      query={<ListQueryBar def={LIST_BARS.deleted} query={view.query} handlers={view.handlers} />}
      refresh={{
        onPress: () => void track("deleted", flows.loadDeleted),
        reason: status === "loading" ? LOADING_REASON : undefined,
      }}
      selection={{ verbs }}
    />
  );

  const rowView = (view: DeletedRowView): RecordRowView => {
    const verb = row(view.id);
    const on = ticked.includes(view.id);
    return {
      state: "deleted",
      ticked: on,
      tick: { label: `Select ${view.name}`, onToggle: (next) => tick(view.id, next) },
      onOpen: () => tick(view.id, !on),
      end: (
        <Button variant="ghost" size="sm" reason={verb.reason} title={RESTORE_TITLE} onClick={verb.press}>
          Restore
        </Button>
      ),
    };
  };

  return (
    <ListGroup id="ti-deleted" icon={Trash2} title={DELETED_TITLES} strip={strip} all={all}>
      <RecordTable
        ariaLabel={DELETED_TITLES}
        columns={deletedTitleColumns}
        rows={view.visible}
        idOf={idOf}
        rowView={rowView}
        waiting={waiting}
        size="bounded"
      />
    </ListGroup>
  );
}
