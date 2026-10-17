import { Folder, Layers } from "lucide-react";
import { useState } from "react";
import { CollectionCreateGroup } from "@/components/collections/CollectionCreateGroup";
import { CollectionDetail } from "@/components/collections/CollectionDetail";
import { CollectionsTable } from "@/components/collections/CollectionsTable";
import { ScanningFolderIcon } from "@/components/collections/ScanningFolderIcon";
import { RailRow } from "@/components/ui/RailRow";
import { Workspace } from "@/components/ui/Workspace";
import { workSpec } from "@/constants/child-window";
import { COLLECTION_ROWS } from "@/fixtures/collections";
import { RAIL_ALL, RAIL_LABEL } from "@/lib/collections-copy";
import { alphabetical } from "@/lib/collections-order";
import { useAppStore } from "@/store/app-store";
import { ChildWindow } from "./ChildWindow";

const SPEC = workSpec("collections", "Collections");
const ALL = "all";
const SORTED = alphabetical(COLLECTION_ROWS);

/** Collections: a work window (`06` section 6.3). The rail lists All, then every collection alphabetically; All holds
 *  the create group and the table, and a selected collection shows its own section. Phase 1 reads the fixtures only. */
export function CollectionsWindow() {
  const closeOverlay = useAppStore((state) => state.closeOverlay);
  const [selected, setSelected] = useState(ALL);
  const chosen = SORTED.find((row) => row.id === selected);

  return (
    <ChildWindow spec={SPEC} onClose={closeOverlay}>
      <div className="flex min-h-0 min-w-0 flex-1 bg-bg">
        <nav
          aria-label={RAIL_LABEL}
          className="flex w-[150px] flex-none flex-col gap-0.5 overflow-y-auto border-r border-hair bg-bg py-1.5"
        >
          <RailRow label={RAIL_ALL} icon={Layers} selected={chosen === undefined} onSelect={() => setSelected(ALL)} />
          {SORTED.map((row) => (
            <RailRow
              key={row.id}
              label={row.name}
              icon={row.scan === "scanning" ? ScanningFolderIcon : Folder}
              count={row.total}
              selected={row.id === selected}
              onSelect={() => setSelected(row.id)}
            />
          ))}
        </nav>
        <section aria-label={chosen?.name ?? RAIL_ALL} className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Workspace>
            {chosen === undefined ? (
              <>
                <CollectionCreateGroup />
                <CollectionsTable rows={SORTED} onSelect={setSelected} />
              </>
            ) : (
              <CollectionDetail key={chosen.id} collection={chosen} onRemoved={() => setSelected(ALL)} />
            )}
          </Workspace>
        </section>
      </div>
    </ChildWindow>
  );
}
