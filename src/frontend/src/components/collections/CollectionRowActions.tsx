import { FolderPlus, Pencil, Trash2 } from "lucide-react";
import type { KeyboardEvent, MouseEvent } from "react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { useArmedAction } from "@/hooks/useArmedAction";
import { useCollectionVerbs } from "@/hooks/useCollectionVerbs";
import { ARM_TIMEOUT_MS, ARMED_LABEL, CONSEQUENCE } from "@/lib/collections-copy";
import type { CollectionRow } from "@/types/collection";

export interface CollectionRowActionsProps {
  readonly row: CollectionRow;
  readonly onRename: () => void;
  /** Called after the fileserver removes the collection. */
  readonly onRemoved: () => void;
}

/* The row itself selects on a click or Enter, so the actions keep their presses to themselves. */
const keep = (event: MouseEvent | KeyboardEvent) => event.stopPropagation();

/** A collection row's actions in the action list, shown on hover and on focus: Attach folder, Rename and Remove. Remove
 *  is the inline two-step (`06` section 2, rule 9): the first press arms it in place and names what it leaves alone; the
 *  second removes the collection. A timeout or focus leaving disarms it. */
export function CollectionRowActions({ row, onRename, onRemoved }: CollectionRowActionsProps) {
  const verbs = useCollectionVerbs();
  const { armed, arm, disarm } = useArmedAction(ARM_TIMEOUT_MS);

  return (
    <span className="flex items-center gap-1" onClick={keep} onKeyDown={keep}>
      {armed ? (
        <Button
          size="sm"
          variant="danger"
          title={CONSEQUENCE}
          autoFocus
          onBlur={disarm}
          onClick={() => {
            disarm();
            if (verbs.remove(row.id)) onRemoved();
          }}
        >
          {ARMED_LABEL}
        </Button>
      ) : (
        <>
          <IconButton aria-label={`Attach a folder to ${row.name}`} title="Attach folder" onClick={() => verbs.attach(row.id)}>
            <FolderPlus className="size-3.5" aria-hidden />
          </IconButton>
          <IconButton aria-label={`Rename ${row.name}`} title="Rename" onClick={onRename}>
            <Pencil className="size-3.5" aria-hidden />
          </IconButton>
          <IconButton
            aria-label={`Remove ${row.name}`}
            title="Remove collection"
            className="hover:text-st-failed"
            onClick={arm}
          >
            <Trash2 className="size-3.5" aria-hidden />
          </IconButton>
        </>
      )}
    </span>
  );
}
