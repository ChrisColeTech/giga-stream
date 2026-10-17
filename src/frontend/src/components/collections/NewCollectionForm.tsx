import { FolderInput, FolderOpen } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Actions, FIELD_CONTROL, Group, Row } from "@/components/ui/Form";
import { Segmented } from "@/components/ui/Segmented";
import { useCollectionVerbs } from "@/hooks/useCollectionVerbs";
import { COLLECTION_NAME_MAX, NAME_BLOCK_REASON, TYPE_CHOICES } from "@/lib/collections-copy";
import { createBlock } from "@/lib/collections-name";
import type { FolderSelection } from "@/services/desktop";
import { useAppStore } from "@/store/app-store";
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
  const [selection, setSelection] = useState<FolderSelection>();
  const [pendingCollectionId, setPendingCollectionId] = useState<string>();
  const desktop = useAppStore((state) => state.runtime === "electron");
  const block = createBlock(name);
  const create = async () => {
    if (pendingCollectionId !== undefined) {
      if (selection === undefined) return;
      if (!(await verbs.attachSelection(pendingCollectionId, selection))) return;
      setName("");
      setSelection(undefined);
      setPendingCollectionId(undefined);
      return;
    }
    if (block !== undefined) return;
    const result = await verbs.create(name.trim(), type, selection);
    if (result.outcome === "created") {
      setName("");
      setSelection(undefined);
    }
    if (result.outcome === "attach-failed") {
      setPendingCollectionId(result.collectionId);
      setSelection(undefined);
    }
  };
  const blocked = pendingCollectionId === undefined ? block !== undefined : selection === undefined;
  const blockedTitle = pendingCollectionId === undefined ? NAME_BLOCK_REASON[block ?? "blank"] : "Choose the folder again.";
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
            if (event.key === "Enter" && !event.nativeEvent.isComposing) void create();
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
          <Button
            variant="ghost"
            disabled={!desktop}
            title={desktop ? "Choose a folder" : "This action is available in the desktop app."}
            onClick={() => void verbs.chooseFolder().then((chosen) => chosen !== null && setSelection(chosen))}
          >
            <FolderOpen aria-hidden /> Choose
          </Button>
        }
      >
        <Input value={selection?.name ?? ""} readOnly className={FIELD_CONTROL} aria-label="Source folder" />
      </Row>
      <Actions>
        <Button
          variant="primary"
          disabled={blocked}
          title={blocked ? blockedTitle : pendingCollectionId === undefined ? "Create the collection" : "Attach the folder"}
          onClick={() => void create()}
        >
          {pendingCollectionId === undefined ? "Create" : "Attach folder"}
        </Button>
      </Actions>
    </Group>
  );
}
