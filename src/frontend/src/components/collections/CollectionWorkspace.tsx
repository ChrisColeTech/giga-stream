import type { CSSProperties } from "react";
import { labelColumn } from "@/components/ui/Form";
import { NavItem, NavRail } from "@/components/ui/NavRail";
import { COLLECTION_FOLDERS, COLLECTION_MEMBERS } from "@/fixtures/collections";
import { LIBRARY_ITEMS } from "@/fixtures/titles";
import { useScrollSpy } from "@/hooks/useScrollSpy";
import { LIST_LABEL } from "@/lib/collections-copy";
import { memberRows } from "@/lib/collections-members";
import type { CollectionRow } from "@/types/collection";
import type { ItemRef } from "@/types/library";
import { CollectionDetailsGroup } from "./CollectionDetailsGroup";
import { CollectionFolders } from "./CollectionFolders";
import { CollectionMembers } from "./CollectionMembers";

const SECTIONS = ["details", "folders", "members"] as const;
const LABEL: Record<(typeof SECTIONS)[number], string> = { details: "Details", folders: "Folders", members: "Members" };

export interface CollectionWorkspaceProps {
  readonly collection: CollectionRow;
  readonly onBack: () => void;
}

/** One collection's workspace, as Sensenova's dataset workspace (pages/datasets/DatasetWorkspace.tsx): LEFT the way back
 *  as a full-width button above the sections; CENTRE one scrolling page holding Details, Folders and Members, which the
 *  rail scrolls to and follows. No delete here: that belongs on the index beside the row. */
export function CollectionWorkspace({ collection, onBack }: CollectionWorkspaceProps) {
  const spy = useScrollSpy(SECTIONS, SECTIONS[0]);
  const refs: readonly ItemRef[] = COLLECTION_MEMBERS[collection.id] ?? [];
  const folders = COLLECTION_FOLDERS[collection.id] ?? [];

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <div className="flex w-[210px] flex-none flex-col border-r border-hair bg-panel">
        <NavRail ariaLabel="Collection sections" back={{ label: LIST_LABEL, onClick: onBack }}>
          {SECTIONS.map((section) => (
            <NavItem key={section} selected={spy.active === section} onClick={() => spy.goTo(section)}>
              {LABEL[section]}
            </NavItem>
          ))}
        </NavRail>
      </div>
      <div ref={spy.container} className="min-h-0 flex-1 overflow-y-auto bg-surface">
        <div className="flex flex-col px-6 pb-8" style={{ "--label-col": labelColumn(["Name"]) } as CSSProperties}>
          <div ref={spy.bind("details")}>
            <CollectionDetailsGroup key={collection.id} collection={collection} />
          </div>
          <div ref={spy.bind("folders")}>
            <CollectionFolders collectionId={collection.id} folders={folders} />
          </div>
          <div ref={spy.bind("members")}>
            <CollectionMembers collectionId={collection.id} rows={memberRows(refs, LIBRARY_ITEMS)} />
          </div>
        </div>
      </div>
    </div>
  );
}
