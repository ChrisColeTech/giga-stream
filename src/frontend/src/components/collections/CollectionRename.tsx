import { Pencil } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Group } from "@/components/ui/Group";
import { Row } from "@/components/ui/Row";
import { Strip } from "@/components/ui/Strip";
import { TextField } from "@/components/ui/TextField";
import { useCollectionVerbs } from "@/hooks/useCollectionVerbs";
import { COLLECTION_NAME_MAX, NAME_BLOCK_REASON } from "@/lib/collections-copy";
import { renameBlock } from "@/lib/collections-name";

/** Rename: the name in an editable field, with Rename at the last row. Rename is disabled only while the draft is blank or
 *  is the name already saved. A refused rename keeps the draft. The parent keys this by the collection. */
export function CollectionRename({ collectionId, name }: { readonly collectionId: string; readonly name: string }) {
  const verbs = useCollectionVerbs();
  const [draft, setDraft] = useState(name);
  const block = renameBlock(draft, name);
  return (
    <Group
      id="collections.rename"
      title="Name"
      icon={Pencil}
      tip="What the rail and Add to collection call this collection."
    >
      <Row label="Name">
        <TextField
          aria-label="Collection name"
          maxLength={COLLECTION_NAME_MAX}
          value={draft}
          onChange={(event) => setDraft(event.currentTarget.value)}
        />
      </Row>
      <Strip>
        <Button
          variant="primary"
          disabled={block !== undefined}
          title={block === undefined ? undefined : NAME_BLOCK_REASON[block]}
          onClick={() => verbs.rename(collectionId, draft.trim())}
        >
          Rename
        </Button>
      </Strip>
    </Group>
  );
}
