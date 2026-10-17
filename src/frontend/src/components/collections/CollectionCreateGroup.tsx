import { FolderPlus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Actions, FIELD_CONTROL, Group, Row } from "@/components/ui/Form";
import { useCollectionVerbs } from "@/hooks/useCollectionVerbs";
import { COLLECTION_NAME_MAX, NAME_BLOCK_REASON } from "@/lib/collections-copy";
import { createBlock } from "@/lib/collections-name";

/** The New collection group: one Name row and Create at the end. Create is disabled only while the name is blank. A
 *  created collection clears the field; a refused one keeps it. */
export function CollectionCreateGroup() {
  const verbs = useCollectionVerbs();
  const [name, setName] = useState("");
  const block = createBlock(name);
  return (
    <Group id="collections.create" title="New collection" icon={FolderPlus}>
      <Row
        label="Name"
        tip="What the collection is called in the rail and in Add to collection. A collection groups titles and local files however you like; removing one never touches the originals."
      >
        <Input
          aria-label="Collection name"
          className={FIELD_CONTROL}
          maxLength={COLLECTION_NAME_MAX}
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
        />
      </Row>
      <Actions>
        <Button
          variant="primary"
          disabled={block !== undefined}
          title={block === undefined ? undefined : NAME_BLOCK_REASON[block]}
          onClick={() => {
            if (verbs.create(name.trim())) setName("");
          }}
        >
          Create
        </Button>
      </Actions>
    </Group>
  );
}
