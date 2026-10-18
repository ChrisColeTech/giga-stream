import { Trash2 } from "lucide-react";
import { Button } from "@giga/ui/controls/Button";
import { RecordGrid } from "@giga/ui/lists/RecordGrid";
import { RecordGridRow } from "@giga/ui/lists/RecordGridRow";
import { SkeletonGrid } from "@giga/ui/lists/SkeletonGrid";
import { BulkNotes } from "@/components/records/BulkNotes";
import { ListGroup } from "@/components/records/ListGroup";
import { DELETED_TITLES, RESTORE_TITLE } from "@/constants/title-copy";
import { DELETED_GRID, DELETED_HEADINGS } from "@/constants/title-grid";
import { useDeletedTitles } from "@/hooks/useDeletedTitles";
import { deletedRow, deletedSelectAll } from "@/lib/title-restore";
import { useAppStore } from "@/store/app-store";

/** `Deleted titles` (`37` section 4.4): the synced titles that were deleted and stay deleted, the name first, then the
 *  kind and when. Its heading's action slot holds the bulk `Restore` over the ticked rows; each row ends with its own
 *  `Restore`. Shimmer rows while the list is read and while it is empty; never a sentence. */
export function DeletedTitlesGroup() {
  const { status, items, ticked } = useAppStore((state) => state.titles.deleted);
  const session = useAppStore((state) => state.titles.session);
  const serial = useAppStore((state) => state.serial);
  const tick = useAppStore((state) => state.titleDeletedTick);
  const tickAll = useAppStore((state) => state.titlesDeletedTickAll);
  const { bulk, notes, dismiss, row } = useDeletedTitles();
  const waiting = items.length === 0 || status === "idle" || session !== serial;

  const action = (
    <Button variant="ghost" size="sm" reason={bulk.reason} onClick={bulk.press}>
      Restore
    </Button>
  );

  return (
    <ListGroup id="ti-deleted" icon={Trash2} title={DELETED_TITLES} action={action}>
      <BulkNotes notes={notes} onDismiss={dismiss} />
      <RecordGrid
        ariaLabel={DELETED_TITLES}
        layout={DELETED_GRID}
        headings={DELETED_HEADINGS}
        selection={{ label: "Select all deleted titles", checked: deletedSelectAll(items, ticked), onToggle: tickAll }}
      >
        {waiting ? (
          <SkeletonGrid />
        ) : (
          items.map((item) => {
            const view = deletedRow(item);
            const verb = row(view.id);
            const on = ticked.includes(view.id);
            return (
              <RecordGridRow
                key={view.id}
                state="deleted"
                ticked={on}
                tick={{ label: `Select ${view.name}`, onToggle: (next) => tick(view.id, next) }}
                onOpen={() => tick(view.id, !on)}
                end={
                  <Button variant="ghost" size="sm" reason={verb.reason} title={RESTORE_TITLE} onClick={verb.press}>
                    Restore
                  </Button>
                }
              >
                <span className="truncate text-text">{view.name}</span>
                <span className="truncate text-muted">{view.kind}</span>
                <span className="truncate font-mono text-xs text-muted">{view.when}</span>
              </RecordGridRow>
            );
          })
        )}
      </RecordGrid>
    </ListGroup>
  );
}
