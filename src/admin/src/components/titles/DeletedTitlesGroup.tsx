import { Trash2 } from "lucide-react";
import { Button } from "@giga/ui/controls/Button";
import { RecordGrid } from "@giga/ui/lists/RecordGrid";
import { RecordGridRow } from "@giga/ui/lists/RecordGridRow";
import { SkeletonGrid } from "@giga/ui/lists/SkeletonGrid";
import { TableStrip } from "@giga/ui/lists/TableStrip";
import { ListGroup } from "@/components/records/ListGroup";
import { DELETED_TITLES, LOADING_REASON, RESTORE_TITLE } from "@/constants/title-copy";
import { DELETED_GRID, DELETED_HEADINGS } from "@/constants/title-grid";
import { useDeletedTitles } from "@/hooks/useDeletedTitles";
import { useTitleActions } from "@/hooks/useTitleActions";
import { deletedRow, deletedSelectAll } from "@/lib/title-restore";
import { useAppStore } from "@/store/app-store";

/** `Deleted titles` (`37` section 4.4): the synced titles that were deleted and stay deleted, the name first, then the
 *  kind and when. Its table strip holds `Refresh` and, once rows are ticked, the count, the bulk `Restore` and `Clear
 *  selection`; each row ends with its own `Restore`. Shimmer rows while the list is read and while it is empty; never a sentence. */
export function DeletedTitlesGroup() {
  const { status, items, ticked } = useAppStore((state) => state.titles.deleted);
  const session = useAppStore((state) => state.titles.session);
  const serial = useAppStore((state) => state.serial);
  const tick = useAppStore((state) => state.titleDeletedTick);
  const tickAll = useAppStore((state) => state.titlesDeletedTickAll);
  const setTicked = useAppStore((state) => state.titlesDeletedSetTicked);
  const { flows, track } = useTitleActions();
  const { verbs, row } = useDeletedTitles();
  const waiting = items.length === 0 || status === "idle" || session !== serial;

  const strip = (
    <TableStrip
      label="Deleted titles table"
      noun="deleted titles"
      refresh={{
        onPress: () => void track("deleted", flows.loadDeleted),
        reason: status === "loading" ? LOADING_REASON : undefined,
      }}
      selection={{ count: ticked.length, verbs, onClear: () => setTicked([]) }}
    />
  );

  return (
    <ListGroup id="ti-deleted" icon={Trash2} title={DELETED_TITLES} strip={strip}>
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
