import { Folder, Layers } from "lucide-react";
import { useMemo, useState } from "react";
import { CollectionCreateGroup } from "@/components/collections/CollectionCreateGroup";
import { CollectionsTable } from "@/components/collections/CollectionsTable";
import { Rail } from "@/components/ui/Rail";
import type { RailEntry } from "@/components/ui/Rail";
import { Workspace } from "@/components/ui/Workspace";
import { workSpec } from "@/constants/child-window";
import { useAppStore } from "@/store/app-store";
import { ChildWindow } from "./ChildWindow";

const SPEC = workSpec("collections", "Collections");

/** Collections: a Work child window. The rail lists All and then every collection alphabetically; All holds the create
 *  group and the table of every collection, and selecting one opens that collection's own section. */
export function CollectionsWindow() {
  const closeOverlay = useAppStore((state) => state.closeOverlay);
  const collections = useAppStore((state) => state.collections);
  const [selected, setSelected] = useState("all");

  const entries = useMemo<ReadonlyArray<RailEntry<string>>>(
    () => [
      { id: "all", label: "All", icon: Layers },
      ...[...collections]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((collection) => ({ id: collection.id, label: collection.name, icon: Folder })),
    ],
    [collections],
  );

  return (
    <ChildWindow spec={SPEC} onClose={closeOverlay}>
      <div className="flex min-h-0 min-w-0 flex-1 bg-bg">
        <Rail label="Collections" entries={entries} selected={selected} onSelect={setSelected} />
        <div role="tabpanel" aria-label={selected} className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Workspace>
            <CollectionCreateGroup />
            <CollectionsTable rows={collections} />
          </Workspace>
        </div>
      </div>
    </ChildWindow>
  );
}
