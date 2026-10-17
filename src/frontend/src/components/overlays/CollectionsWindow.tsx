import { useState } from "react";
import { CollectionsIndex } from "@/components/collections/CollectionsIndex";
import { CollectionWorkspace } from "@/components/collections/CollectionWorkspace";
import { workSpec } from "@/constants/child-window";
import { COLLECTION_ROWS } from "@/fixtures/collections";
import { LIST_LABEL } from "@/lib/collections-copy";
import { alphabetical } from "@/lib/collections-order";
import { useAppStore } from "@/store/app-store";
import { ChildWindow } from "./ChildWindow";

const SPEC = workSpec("collections", "Collections");
const ROWS = alphabetical(COLLECTION_ROWS);

/** Collections: a work window (`06` section 6.3) with LoRA Studio's index and workspace flow (its Datasets and Dataset
 *  pages). It opens on the index, which has no rail; a tile opens that collection's workspace, which has the rail and
 *  its `← Collections` back link. Phase 1 reads the fixtures only. */
export function CollectionsWindow() {
  const closeOverlay = useAppStore((state) => state.closeOverlay);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = ROWS.find((row) => row.id === openId);

  return (
    <ChildWindow spec={SPEC} onClose={closeOverlay}>
      <section aria-label={open?.name ?? LIST_LABEL} className="flex min-h-0 min-w-0 flex-1 flex-col bg-bg">
        {open === undefined ? (
          <CollectionsIndex rows={ROWS} onOpen={setOpenId} />
        ) : (
          <CollectionWorkspace key={open.id} collection={open} onBack={() => setOpenId(null)} />
        )}
      </section>
    </ChildWindow>
  );
}
