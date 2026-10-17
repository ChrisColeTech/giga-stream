import { useEffect, useState } from "react";
import { CollectionsIndex } from "@/components/collections/CollectionsIndex";
import { CollectionWorkspace } from "@/components/collections/CollectionWorkspace";
import { workSpec } from "@/constants/child-window";
import { useCollectionsData } from "@/hooks/useCollectionsData";
import { LIST_LABEL } from "@/lib/collections-copy";
import { collectionRow } from "@/lib/collections-model";
import { alphabetical } from "@/lib/collections-order";
import { useAppStore } from "@/store/app-store";
import { ChildWindow } from "@giga/ui/windows/ChildWindow";

const SPEC = workSpec("collections", "Collections");

/** Collections: a work window (`06` section 6.3) with LoRA Studio's index and workspace flow (its Datasets and Dataset
 *  pages). It opens on the index, which has no rail; a tile opens that collection's workspace, which has the rail and
 *  its `← Collections` back link; opened from a collection's menu, it starts on that workspace. */
export function CollectionsWindow() {
  useCollectionsData();
  const closeOverlay = useAppStore((state) => state.closeOverlay);
  const collections = useAppStore((state) => state.collections);
  /* A rail menu's Rename or Remove opens the window on that collection's workspace; read once, as the window opens. */
  const [openId, setOpenId] = useState<string | null>(() => useAppStore.getState().collectionsFocus);
  useEffect(() => void useAppStore.getState().takeCollectionsFocus(), []);
  const rows = alphabetical(collections.map(collectionRow));
  const open = collections.find((collection) => collection.id === openId);

  return (
    <ChildWindow spec={SPEC} onClose={closeOverlay}>
      <section aria-label={open?.name ?? LIST_LABEL} className="flex min-h-0 min-w-0 flex-1 flex-col bg-bg">
        {open === undefined ? (
          <CollectionsIndex rows={rows} onOpen={setOpenId} />
        ) : (
          <CollectionWorkspace key={open.id} collection={open} onBack={() => setOpenId(null)} />
        )}
      </section>
    </ChildWindow>
  );
}
