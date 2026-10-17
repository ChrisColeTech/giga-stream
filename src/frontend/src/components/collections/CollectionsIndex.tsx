import { Workspace } from "@/components/ui/Form";
import { useCollectionVerbs } from "@/hooks/useCollectionVerbs";
import type { CollectionRow } from "@/types/collection";
import { CollectionRows } from "./CollectionRows";
import { NEW_COLLECTION_LABELS, NewCollectionForm } from "./NewCollectionForm";

export interface CollectionsIndexProps {
  readonly rows: readonly CollectionRow[];
  readonly onOpen: (id: string) => void;
}

/** The Collections index, as Sensenova's Datasets index (pages/datasets/DatasetsIndex.tsx): no rail; the create form,
 *  then the stored collections. A row opens its workspace; Delete is beside the row, never inside the workspace. */
export function CollectionsIndex({ rows, onOpen }: CollectionsIndexProps) {
  const verbs = useCollectionVerbs();
  return (
    <Workspace labels={NEW_COLLECTION_LABELS}>
      <NewCollectionForm />
      <CollectionRows rows={rows} onRefresh={verbs.refresh} onOpen={onOpen} onDelete={verbs.remove} />
    </Workspace>
  );
}
