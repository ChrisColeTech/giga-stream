import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { Button } from "@giga/ui/controls/Button";
import { Input } from "@giga/ui/controls/Input";
import { Actions, FIELD_CONTROL, Group, Row } from "@/components/ui/Form";
import { Segmented } from "@giga/ui/controls/Segmented";
import { useCollectionVerbs } from "@/hooks/useCollectionVerbs";
import { COLLECTION_NAME_MAX, NAME_BLOCK_REASON, TYPE_CHOICES } from "@/lib/collections-copy";
import type { CollectionRow, CollectionType } from "@/types/collection";

/** A collection's Details, as Sensenova's dataset DetailsGroup: the name and the type in their rows, Save details ending
 *  the group. Save is disabled while the name is blank or nothing has changed; a refused save keeps the draft. The
 *  workspace keys it by the collection. */
export function CollectionDetailsGroup({ collection }: { readonly collection: CollectionRow }) {
  const verbs = useCollectionVerbs();
  const [name, setName] = useState(collection.name);
  const [type, setType] = useState<CollectionType>(collection.type);
  const blank = name.trim() === "";
  const unchanged = name.trim() === collection.name.trim() && type === collection.type;
  const reason = blank ? NAME_BLOCK_REASON.blank : unchanged ? "Nothing has changed." : undefined;
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
      <Row label="Type" tip="What the collection holds: movies, TV series, or your own local files.">
        <Segmented aria-label="Collection type" options={TYPE_CHOICES} value={type} onChange={setType} />
      </Row>
      <Actions>
        <Button
          variant="primary"
          disabled={reason !== undefined}
          title={reason ?? "Save the name and type"}
          onClick={() => void verbs.update(collection.id, name.trim(), type)}
        >
          Save details
        </Button>
      </Actions>
    </Group>
  );
}
