import type { CSSProperties } from "react";
import { labelColumn } from "@giga/ui/lib/label-column";
import { NavItem } from "@giga/ui/lists/NavItem";
import { NavRail } from "@giga/ui/lists/NavRail";
import { useScrollSpy } from "@giga/ui/hooks/useScrollSpy";
import { useCollectionMembers } from "@/hooks/useCollectionMembers";
import { LIST_LABEL } from "@/lib/collections-copy";
import { collectionFolder, collectionRow } from "@/lib/collections-model";
import type { CollectionAnswer } from "@/services/collections";
import { useAppStore } from "@/store/app-store";
import { CollectionDetailsGroup } from "./CollectionDetailsGroup";
import { CollectionFolders } from "./CollectionFolders";
import { CollectionMembers } from "./CollectionMembers";

const SECTIONS = ["details", "folders", "videos"] as const;
const LABEL: Record<(typeof SECTIONS)[number], string> = { details: "Details", folders: "Folders", videos: "Videos" };

export interface CollectionWorkspaceProps {
  readonly collection: CollectionAnswer;
  readonly onBack: () => void;
}

/** One collection's workspace, as Sensenova's dataset workspace (pages/datasets/DatasetWorkspace.tsx): LEFT the way back
 *  as a full-width button above the sections; CENTRE one scrolling page holding Details, Folders and Videos, which the
 *  rail scrolls to and follows. No delete here: that belongs on the index beside the row. */
export function CollectionWorkspace({ collection, onBack }: CollectionWorkspaceProps) {
  const spy = useScrollSpy(SECTIONS, SECTIONS[0]);
  const progress = useAppStore((state) => state.scanProgress);
  const row = collectionRow(collection);
  const folders = collection.folders.map((folder) => collectionFolder(folder, progress[folder.id]));
  const members = useCollectionMembers(collection.id);

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
            <CollectionDetailsGroup key={collection.id} collection={row} />
          </div>
          <div ref={spy.bind("folders")}>
            <CollectionFolders collectionId={collection.id} folders={folders} />
          </div>
          <div ref={spy.bind("videos")}>
            <CollectionMembers collectionId={collection.id} rows={members.rows}
              status={members.loading ? "not-loaded" : "loaded"} onRemoved={members.refresh} />
          </div>
        </div>
      </div>
    </div>
  );
}
