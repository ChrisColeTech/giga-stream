import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Actions, FIELD_CONTROL, Group, Row } from "@/components/ui/Form";
import { useCollectionVerbs } from "@/hooks/useCollectionVerbs";
import { COLLECTION_NAME_MAX, NAME_BLOCK_REASON } from "@/lib/collections-copy";
import { renameBlock } from "@/lib/collections-name";
import type { CollectionRow } from "@/types/collection";

/** A collection's Details, as Sensenova's dataset DetailsGroup: the name in its row, Save details ending the group. Save
 *  is disabled while the draft is blank or unchanged; a refused save keeps the draft. The workspace keys it by the
 *  collection. */
export function CollectionDetailsGroup({ collection }: { readonly collection: CollectionRow }) {
  const verbs = useCollectionVerbs();
  const [name, setName] = useState(collection.name);
  const block = renameBlock(name, collection.name);
  return (
    <Group icon={SlidersHorizontal} title="Details">
      <Row label="Name" tip="What the collection is called in Library's rail and in Add to collection.">
        <Input
          value={name}
          className={FIELD_CONTROL}
          aria-label="Collection name"
          maxLength={COLLECTION_NAME_MAX}
          spellCheck={false}
          onChange={(event) => setName(event.target.value)}
        />
      </Row>
      <Actions>
        <Button
          variant="primary"
          disabled={block !== undefined}
          title={block === undefined ? "Save the name" : NAME_BLOCK_REASON[block]}
          onClick={() => verbs.rename(collection.id, name.trim())}
        >
          Save details
        </Button>
      </Actions>
    </Group>
  );
}
