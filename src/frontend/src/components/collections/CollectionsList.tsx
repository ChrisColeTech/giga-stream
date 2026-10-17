import { ChevronRight, Folder, Library } from "lucide-react";
import { useState } from "react";
import { ActionList, type ActionItem } from "@/components/ui/ActionList";
import { Group, Wide, type Accent } from "@/components/ui/Form";
import { SCAN_LABEL, SKELETON_ROW_COUNT } from "@/lib/collections-copy";
import type { CollectionRow } from "@/types/collection";
import { CollectionRenameRow } from "./CollectionRenameRow";
import { CollectionRowActions } from "./CollectionRowActions";

/* The scan state as the row's left-edge bar (LoRA's ActionList ramp): a running scan in warning, a failed one in error. */
const SCAN_ACCENT: Readonly<Record<CollectionRow["scan"], Accent>> = { idle: "none", scanning: "warning", failed: "error" };

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** A row's description: its totals, and its scan state when one is running or has failed. */
function describe(row: CollectionRow): string {
  const parts = [plural(row.total, "item"), `${row.manual} manual`, plural(row.folders, "folder")];
  if (row.scan !== "idle") parts.push(SCAN_LABEL[row.scan]);
  return parts.join(" · ");
}

export interface CollectionsListProps {
  readonly rows: readonly CollectionRow[];
  readonly onSelect: (id: string) => void;
}

/** Every collection, on LoRA Studio's action list (components/ui/ActionList.tsx): a row per collection with its scan bar,
 *  name and totals; on hover, Attach folder, Rename (in place, over the list) and a two-step Remove; a press opens the
 *  collection. With none, the list is skeleton rows of the same shape. */
export function CollectionsList({ rows, onSelect }: CollectionsListProps) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const renamed = rows.find((row) => row.id === renaming);
  const items: ActionItem[] = rows.map((row) => ({
    id: row.id,
    title: row.name,
    description: describe(row),
    icon: <Folder className="size-4" aria-hidden />,
    accent: SCAN_ACCENT[row.scan],
    actions: (
      <CollectionRowActions
        row={row}
        onRename={() => setRenaming(row.id)}
        onRemoved={() => setRenaming((current) => (current === row.id ? null : current))}
      />
    ),
    trailing: <ChevronRight className="size-4" aria-hidden />,
  }));

  return (
    <Group id="collections.list" title="Collections" icon={Library} badge={String(rows.length)} last>
      {renamed !== undefined && (
        <CollectionRenameRow key={renamed.id} collection={renamed} onDone={() => setRenaming(null)} />
      )}
      <Wide>
        <ActionList items={items} onSelect={onSelect} skeleton={SKELETON_ROW_COUNT} />
      </Wide>
    </Group>
  );
}
