import { useRef, useState } from "react";
import { Workspace } from "@/components/ui/Form";
import { COLLECTION_FOLDERS, COLLECTION_MEMBERS } from "@/fixtures/collections";
import { LIBRARY_ITEMS } from "@/fixtures/titles";
import { useSectionSpy } from "@/hooks/useSectionSpy";
import { memberRows } from "@/lib/collections-members";
import type { CollectionRow } from "@/types/collection";
import type { ItemRef } from "@/types/library";
import { COLLECTION_SECTIONS, CollectionNav, type CollectionSection } from "./CollectionNav";
import { CollectionFolders } from "./CollectionFolders";
import { CollectionMembers } from "./CollectionMembers";

export interface CollectionWorkspaceProps {
  readonly collection: CollectionRow;
  readonly onBack: () => void;
}

/** One collection's workspace, as LoRA's Dataset page (pages/DatasetPage.tsx): LEFT the rail (`← Collections`, the name,
 *  the sections) · CENTRE one page of sections, Folders then Members, which the rail jumps to and follows as the page
 *  scrolls. Editing the name and removing the collection live on the index, as LoRA keeps them. */
export function CollectionWorkspace({ collection, onBack }: CollectionWorkspaceProps) {
  const [section, setSection] = useState<CollectionSection>("folders");
  const scroller = useRef<HTMLDivElement | null>(null);
  const refs: readonly ItemRef[] = COLLECTION_MEMBERS[collection.id] ?? [];
  const folders = COLLECTION_FOLDERS[collection.id] ?? [];

  const jump = (id: CollectionSection) => {
    setSection(id);
    scroller.current?.querySelector(`#section-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  useSectionSpy(scroller, COLLECTION_SECTIONS, "section-", setSection);

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <div className="flex w-[150px] flex-none flex-col border-r border-hair bg-panel lg:w-[210px]">
        <CollectionNav
          collection={collection}
          section={section}
          counts={{ folders: folders.length, members: refs.length }}
          onSection={jump}
          onBack={onBack}
        />
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Workspace>
          <div ref={scroller} className="contents">
            <CollectionFolders collectionId={collection.id} folders={folders} />
            <CollectionMembers collectionId={collection.id} rows={memberRows(refs, LIBRARY_ITEMS)} />
          </div>
        </Workspace>
      </div>
    </div>
  );
}
