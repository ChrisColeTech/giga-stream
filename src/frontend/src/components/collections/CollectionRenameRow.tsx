import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Actions, FIELD_CONTROL, Row } from "@/components/ui/Form";
import { useCollectionVerbs } from "@/hooks/useCollectionVerbs";
import { COLLECTION_NAME_MAX, NAME_BLOCK_REASON } from "@/lib/collections-copy";
import { renameBlock } from "@/lib/collections-name";
import type { CollectionRow } from "@/types/collection";

export interface CollectionRenameRowProps {
  readonly collection: CollectionRow;
  /** Closes the form: after a rename the fileserver accepts, on Cancel, or on Escape. */
  readonly onDone: () => void;
}

/** Rename in place, over the list: the name in a field with Cancel and Rename. Rename is disabled while the draft is blank
 *  or unchanged; a refused rename keeps the draft. The list keys it by the collection. */
export function CollectionRenameRow({ collection, onDone }: CollectionRenameRowProps) {
  const verbs = useCollectionVerbs();
  const [draft, setDraft] = useState(collection.name);
  const block = renameBlock(draft, collection.name);
  const commit = () => {
    if (block === undefined && verbs.rename(collection.id, draft.trim())) onDone();
  };
  return (
    <>
      <Row label="Rename" tip={`The new name for ${collection.name}.`}>
        <Input
          aria-label={`New name for ${collection.name}`}
          className={FIELD_CONTROL}
          maxLength={COLLECTION_NAME_MAX}
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              onDone();
            }
            if (event.key === "Enter" && !event.nativeEvent.isComposing) commit();
          }}
        />
      </Row>
      <Actions left={<Button variant="ghost" onClick={onDone}>Cancel</Button>}>
        <Button
          variant="primary"
          disabled={block !== undefined}
          title={block === undefined ? undefined : NAME_BLOCK_REASON[block]}
          onClick={commit}
        >
          Rename
        </Button>
      </Actions>
    </>
  );
}
