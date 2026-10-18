import { useMemo } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@giga/ui/controls/Button";
import { RecordTable } from "@giga/ui/lists/RecordTable";
import type { RecordRowView } from "@giga/ui/lists/record-table-types";
import { TableStrip } from "@giga/ui/lists/TableStrip";
import { ListGroup } from "@/components/records/ListGroup";
import { DELETED_TITLES, LOADING_REASON, RESTORE_TITLE } from "@/constants/title-copy";
import { useDeletedTitles } from "@/hooks/useDeletedTitles";
import { useTitleActions } from "@/hooks/useTitleActions";
import { deletedRow, deletedSelectAll, type DeletedRowView } from "@/lib/title-restore";
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
  const tickAll = useAppStore((state) => state.titlesDeletedTickAll);
  const { flows, track } = useTitleActions();
  const { verbs, row } = useDeletedTitles();
  const waiting = items.length === 0 || status === "idle" || session !== serial;
  const rows = useMemo(() => items.map(deletedRow), [items]);
  const all = {
    label: "Select all deleted titles",
    checked: deletedSelectAll(items, ticked),
    onToggle: tickAll,
    disabled: items.length === 0,
  };

  const strip = (
    <TableStrip
      label="Deleted titles table"
      noun="deleted titles"
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
        rows={rows}
        idOf={idOf}
        rowView={rowView}
        waiting={waiting}
        size="bounded"
      />
    </ListGroup>
  );
}
