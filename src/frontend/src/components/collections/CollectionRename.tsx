import { Pencil } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Group } from "@/components/ui/Group";
import { Row } from "@/components/ui/Row";
import { Strip } from "@/components/ui/Strip";
import { TextField } from "@/components/ui/TextField";
import { COLLECTION_NAME_MAX, RENAME_REASON } from "@/lib/collections-copy";

/** Rename: the name in an editable field, with Rename at the last row. The field edits its own draft; Rename has
 *  nothing to send in phase 1, so it is disabled with its reason. The parent keys this by the collection, so a draft
 *  never carries over. */
export function CollectionRename({ name }: { readonly name: string }) {
  const [draft, setDraft] = useState(name);
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
        <Button variant="primary" disabled title={RENAME_REASON}>
          Rename
        </Button>
      </Strip>
    </Group>
  );
}
