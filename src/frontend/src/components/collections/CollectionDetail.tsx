import { COLLECTION_FOLDERS, COLLECTION_MEMBERS } from "@/fixtures/collections";
import { LIBRARY_ITEMS } from "@/fixtures/titles";
import { memberRows } from "@/lib/collections-members";
import type { CollectionRow } from "@/types/collection";
import type { ItemRef } from "@/types/library";
import { CollectionFolders } from "./CollectionFolders";
import { CollectionMembers } from "./CollectionMembers";
import { CollectionRemove } from "./CollectionRemove";
import { CollectionRename } from "./CollectionRename";

/** One collection's own section (`06` section 6.3): its name as a heading, then its rename, its members, its folders
 *  and the removal. The window keys it by the collection's id, so a draft never carries over to another collection. */
export function CollectionDetail({ collection }: { readonly collection: CollectionRow }) {
  const refs: readonly ItemRef[] = COLLECTION_MEMBERS[collection.id] ?? [];
  const folders = COLLECTION_FOLDERS[collection.id] ?? [];
  return (
    <div className="flex min-w-0 flex-col">
      <h3 className="m-0 truncate pt-3 font-sans text-base font-semibold text-text">{collection.name}</h3>
      <CollectionRename name={collection.name} />
      <CollectionMembers rows={memberRows(refs, LIBRARY_ITEMS)} />
      <CollectionFolders folders={folders} />
      <CollectionRemove />
    </div>
  );
}
