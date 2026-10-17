import { FolderOpen, FolderPen, FolderPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Actions, FIELD_CONTROL, Group, Row } from "@/components/ui/Form";
import { useCollectionVerbs } from "@/hooks/useCollectionVerbs";
import { COLLECTION_NAME_MAX, NAME_BLOCK_REASON } from "@/lib/collections-copy";
import { createBlock, renameBlock } from "@/lib/collections-name";
import type { CollectionRow } from "@/types/collection";

/** The labels the form's rows carry, so the index sizes its label column once. */
export const COLLECTION_FORM_LABELS = ["Name", "Folder"] as const;

export interface CollectionFormProps {
  /** The collection a tile's pencil put in the form; null for a new one. */
  readonly editing: CollectionRow | null;
  readonly onCancel: () => void;
}

/** The form above the index, as LoRA's DatasetForm sits above the Datasets (create, and edit from a tile's pencil):
 *  New collection takes a name and an optional folder to start from; Edit collection takes the name, with Cancel. The
 *  verb is disabled only while the name is blank or unchanged; a refused one keeps the draft. */
export function CollectionForm({ editing, onCancel }: CollectionFormProps) {
  const verbs = useCollectionVerbs();
  const [name, setName] = useState("");
  /* A tile's pencil fills the form; Cancel or a save empties it. */
  useEffect(() => setName(editing?.name ?? ""), [editing]);
  const block = editing === null ? createBlock(name) : renameBlock(name, editing.name);

  const submit = () => {
    if (block !== undefined) return;
    if (editing === null) {
      if (verbs.create(name.trim())) setName("");
    } else if (verbs.rename(editing.id, name.trim())) onCancel();
  };

  return (
    <Group id="collections.form" title={editing === null ? "New collection" : "Edit collection"} icon={editing === null ? FolderPlus : FolderPen}>
      <Row label="Name" tip="What the collection is called in Library's rail and in Add to collection.">
        <Input
          aria-label="Collection name"
          className={FIELD_CONTROL}
          maxLength={COLLECTION_NAME_MAX}
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) submit();
          }}
        />
      </Row>
      {editing === null && (
        <Row
          label="Folder"
          tip="Start the collection from a folder: its videos join as the folder is scanned. Files on disk are only read, never changed."
        >
          <Button onClick={() => verbs.chooseFolder()}>
            <FolderOpen aria-hidden /> Choose folder…
          </Button>
        </Row>
      )}
      <Actions left={editing === null ? undefined : <Button variant="ghost" onClick={onCancel}>Cancel</Button>}>
        <Button
          variant="primary"
          disabled={block !== undefined}
          title={block === undefined ? undefined : NAME_BLOCK_REASON[block]}
          onClick={submit}
        >
          {editing === null ? "Create" : "Save"}
        </Button>
      </Actions>
    </Group>
  );
}
