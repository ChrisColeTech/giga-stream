import { FolderPlus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Group } from "@/components/ui/Group";
import { Row } from "@/components/ui/Row";
import { Strip } from "@/components/ui/Strip";
import { TextField } from "@/components/ui/TextField";
import { useCollectionVerbs } from "@/hooks/useCollectionVerbs";
import { COLLECTION_NAME_MAX, NAME_BLOCK_REASON } from "@/lib/collections-copy";
import { createBlock } from "@/lib/collections-name";

/** The New collection group: one Name row and Create at the last row. Create is disabled only while the name is blank. A
 *  created collection clears the field; a refused one keeps it. */
export function CollectionCreateGroup() {
  const verbs = useCollectionVerbs();
  const [name, setName] = useState("");
  const block = createBlock(name);
  return (
    <Group
      id="collections.create"
      title="New collection"
      icon={FolderPlus}
      tip="A collection groups titles and local files however you like. Removing one never touches the originals."
    >
      <Row label="Name" tip="What the collection is called in the rail and in Add to collection.">
        <TextField
          aria-label="Collection name"
          maxLength={COLLECTION_NAME_MAX}
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
        />
      </Row>
      <Strip>
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
      </Strip>
    </Group>
  );
}
