import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { CollectionCreateGroup } from "@/components/collections/CollectionCreateGroup";
import { CollectionDetail } from "@/components/collections/CollectionDetail";
import { CollectionsList } from "@/components/collections/CollectionsList";
import { Workspace } from "@/components/ui/Form";
import { workSpec } from "@/constants/child-window";
import { COLLECTION_ROWS } from "@/fixtures/collections";
import { LIST_LABEL } from "@/lib/collections-copy";
import { alphabetical } from "@/lib/collections-order";
import { useAppStore } from "@/store/app-store";
import { ChildWindow } from "./ChildWindow";

const SPEC = workSpec("collections", "Collections");
const SORTED = alphabetical(COLLECTION_ROWS);
const LABELS = ["Name", "Folder", "Rename"] as const;

/** Collections: a work window (`06` section 6.3) with no rail of its own, since its list already names every collection.
 *  It opens on the list (New collection, then every collection with its actions); a press opens that collection, and the
 *  back link at its top returns to the list. Phase 1 reads the fixtures only. */
export function CollectionsWindow() {
  const closeOverlay = useAppStore((state) => state.closeOverlay);
  const [selected, setSelected] = useState<string | null>(null);
  const chosen = SORTED.find((row) => row.id === selected);

  return (
    <ChildWindow spec={SPEC} onClose={closeOverlay}>
      <section aria-label={chosen?.name ?? LIST_LABEL} className="flex min-h-0 min-w-0 flex-1 flex-col bg-bg">
        <Workspace labels={LABELS}>
          {chosen === undefined ? (
            <>
              <CollectionCreateGroup />
              <CollectionsList rows={SORTED} onSelect={setSelected} />
            </>
          ) : (
            <>
              <div className="flex min-w-0 items-center gap-2 pt-4">
                <button
                  type="button"
                  className="flex cursor-pointer items-center gap-1.5 rounded-ctl border-0 bg-transparent px-1.5 py-1 text-sm text-faint hover:bg-hov hover:text-text"
                  onClick={() => setSelected(null)}
                >
                  <ArrowLeft className="size-3.5" aria-hidden />
                  {LIST_LABEL}
                </button>
                <span className="text-sm text-dim" aria-hidden>
                  /
                </span>
                <span className="min-w-0 truncate text-sm font-semibold text-text">{chosen.name}</span>
              </div>
              <CollectionDetail key={chosen.id} collection={chosen} onRemoved={() => setSelected(null)} />
            </>
          )}
        </Workspace>
      </section>
    </ChildWindow>
  );
}
