import { FolderInput, FolderOpen } from "lucide-react";
import { useState } from "react";
import { Button } from "@giga/ui/controls/Button";
import { Input } from "@giga/ui/controls/Input";
import { Actions } from "@giga/ui/form/Actions";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { Group } from "@giga/ui/form/Group";
import { Row } from "@giga/ui/form/Row";
import { Segmented } from "@giga/ui/controls/Segmented";
import { useCollectionVerbs } from "@/hooks/useCollectionVerbs";
import { COLLECTION_NAME_MAX, NAME_BLOCK_REASON, TYPE_CHOICES } from "@/lib/collections-copy";
import { createBlock } from "@/lib/collections-name";
import type { CollectionType } from "@/types/collection";

/** The labels the form's rows carry, so the index fixes its label column once. */
export const NEW_COLLECTION_LABELS = ["Name", "Type", "Folder"] as const;

/** The create form, as Sensenova's New dataset form (pages/datasets/NewDatasetForm.tsx): a name, its type (Movies, TV
 *  or Local, a one-of pill choice), and an optional folder to start from, chosen through the native picker on the row's
 *  trailing edge; Create ends the group. Create is disabled only while the name is blank; a created collection clears
 *  the field, a refused one keeps it. Delta: no placeholder text (banned in Giga Stream). */
export function NewCollectionForm() {
  const verbs = useCollectionVerbs();
  const [name, setName] = useState("");
  const [type, setType] = useState<CollectionType>("movie");
  const block = createBlock(name);
  const create = () => {
    if (block === undefined && verbs.create(name.trim(), type)) setName("");
  };
  return (
    <Group icon={FolderInput} title="New collection">
      <Row label="Name" tip="What the collection is called in Library's rail and in Add to collection.">
        <Input
          value={name}
          className={FIELD_CONTROL}
          aria-label="Collection name"
          maxLength={COLLECTION_NAME_MAX}
          spellCheck={false}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) create();
          }}
        />
      </Row>
      <Row label="Type" tip="What the collection holds: movies, TV series, or your own local files.">
        <Segmented aria-label="Collection type" options={TYPE_CHOICES} value={type} onChange={setType} />
      </Row>
      <Row
        label="Folder"
        tip="Start the collection from a folder: its videos join as it is scanned. Files on disk are only read, never changed."
        trailing={
          <Button variant="ghost" onClick={() => verbs.chooseFolder()}>
            <FolderOpen aria-hidden /> Choose
          </Button>
        }
      >
        <Input value="" readOnly className={FIELD_CONTROL} aria-label="Source folder" />
      </Row>
      <Actions>
        <Button
          variant="primary"
          disabled={block !== undefined}
          title={block === undefined ? "Create the collection" : NAME_BLOCK_REASON[block]}
          onClick={create}
        >
          Create
        </Button>
      </Actions>
    </Group>
  );
}
