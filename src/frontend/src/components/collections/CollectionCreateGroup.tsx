import { FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Group } from "@/components/ui/Group";
import { Row } from "@/components/ui/Row";
import { Strip } from "@/components/ui/Strip";
import { TextField } from "@/components/ui/TextField";
import { COLLECTIONS_PENDING } from "@/constants/collections";

/** The New collection group: one Name row and the one Create action in the final row. No collection exists until its
 *  final action succeeds. Until the library service exists, the field and the action are disabled with that sentence on
 *  the field itself, where it is read, and as the action's tooltip. */
export function CollectionCreateGroup() {
  return (
    <Group
      id="collections.create"
      title="New collection"
      icon={FolderPlus}
      tip="A collection groups titles and local files however you like. Removing one never touches the originals."
    >
      <Row label="Name" tip="What the collection is called in the rail and in Add to collection." reason={COLLECTIONS_PENDING}>
        <TextField aria-label="Collection name" placeholder={COLLECTIONS_PENDING} maxLength={100} disabled />
      </Row>
      <Strip>
        <Button variant="primary" disabled title={COLLECTIONS_PENDING}>
          Create
        </Button>
      </Strip>
    </Group>
  );
}
