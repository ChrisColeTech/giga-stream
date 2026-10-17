import { Library } from "lucide-react";
import { useMemo, useState } from "react";
import { Group, Wide, Workspace } from "@/components/ui/Form";
import { useCollectionVerbs } from "@/hooks/useCollectionVerbs";
import type { CollectionRow } from "@/types/collection";
import { COLLECTION_FORM_LABELS, CollectionForm } from "./CollectionForm";
import { CollectionTiles } from "./CollectionTiles";
import { CollectionToolbar, type CollectionSort, type CollectionView } from "./CollectionToolbar";

const BY: Record<CollectionSort, (a: CollectionRow, b: CollectionRow) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  items: (a, b) => b.total - a.total,
  folders: (a, b) => b.folders - a.folders,
};

export interface CollectionsIndexProps {
  readonly rows: readonly CollectionRow[];
  readonly onOpen: (id: string) => void;
}

/** The Collections index, as LoRA's Datasets page (pages/DatasetsPage.tsx): no rail; the form (New collection, or Edit
 *  collection from a tile's pencil) above the Collections group, whose first row is search, sort and Grid / List, then
 *  the tiles. A tile opens that collection's workspace; its trash is the inline Remove / Keep. */
export function CollectionsIndex({ rows, onOpen }: CollectionsIndexProps) {
  const verbs = useCollectionVerbs();
  const [editing, setEditing] = useState<CollectionRow | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [view, setView] = useState<CollectionView>("grid");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<CollectionSort>("name");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => q === "" || row.name.toLowerCase().includes(q)).sort(BY[sort]);
  }, [rows, query, sort]);
  const badge = query.trim() === "" ? String(rows.length) : `${shown.length} of ${rows.length}`;

  return (
    <Workspace labels={COLLECTION_FORM_LABELS}>
      <CollectionForm editing={editing} onCancel={() => setEditing(null)} />
      <Group id="collections.list" icon={Library} title="Collections" badge={badge} last>
        <Wide>
          <CollectionToolbar query={query} onQuery={setQuery} sort={sort} onSort={setSort} view={view} onView={setView} />
          <CollectionTiles
            rows={shown}
            view={view}
            onOpen={(row) => onOpen(row.id)}
            onEdit={setEditing}
            confirmId={confirmId}
            onAskRemove={setConfirmId}
            onRemove={(row) => {
              if (verbs.remove(row.id)) setConfirmId(null);
            }}
            onKeep={() => setConfirmId(null)}
          />
        </Wide>
      </Group>
    </Workspace>
  );
}
