import { FolderPlus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Group } from "@/components/ui/Group";
import { Row } from "@/components/ui/Row";
import { Strip } from "@/components/ui/Strip";
import { TextField } from "@/components/ui/TextField";
import { COLLECTION_NAME_MAX, CREATE_REASON } from "@/lib/collections-copy";

/** The New collection group: one Name row and Create at the last row. The field is editable as the look and carries no
 *  placeholder; Create is disabled with its reason. */
export function CollectionCreateGroup() {
  const [name, setName] = useState("");
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
        <Button variant="primary" disabled title={CREATE_REASON}>
          Create
        </Button>
      </Strip>
    </Group>
  );
}
