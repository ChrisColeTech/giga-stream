import { useState } from "react";
import { CollectionCreateGroup } from "@/components/collections/CollectionCreateGroup";
import { CollectionDetail } from "@/components/collections/CollectionDetail";
import { CollectionsTable } from "@/components/collections/CollectionsTable";
import { Workspace } from "@/components/ui/Form";
import { NavGroup, NavItem, NavRail } from "@/components/ui/NavRail";
import { StatusDot } from "@/components/ui/StatusDot";
import { workSpec } from "@/constants/child-window";
import { COLLECTION_ROWS } from "@/fixtures/collections";
import { RAIL_ALL, RAIL_LABEL } from "@/lib/collections-copy";
import { alphabetical } from "@/lib/collections-order";
import { useAppStore } from "@/store/app-store";
import { ChildWindow } from "./ChildWindow";

const SPEC = workSpec("collections", "Collections");
const ALL = "all";
const SORTED = alphabetical(COLLECTION_ROWS);
const LABELS = ["Name", "Folder"] as const;

/** Collections: a work window (`06` section 6.3). The rail lists All, then every collection alphabetically, a scan dot
 *  beside any whose folder is scanning; All holds the create group and the table, and a selected collection shows its
 *  own section. Phase 1 reads the fixtures only. */
export function CollectionsWindow() {
  const closeOverlay = useAppStore((state) => state.closeOverlay);
  const [selected, setSelected] = useState(ALL);
  const chosen = SORTED.find((row) => row.id === selected);

  return (
    <ChildWindow spec={SPEC} onClose={closeOverlay}>
      <div className="flex min-h-0 min-w-0 flex-1 bg-bg">
        <div className="flex w-[150px] flex-none flex-col border-r border-hair bg-panel lg:w-[210px]">
          <NavRail ariaLabel={RAIL_LABEL}>
            <NavItem selected={chosen === undefined} onClick={() => setSelected(ALL)}>
              {RAIL_ALL}
            </NavItem>
            <NavGroup heading="Collections">
              {SORTED.map((row) => (
                <NavItem key={row.id} selected={row.id === selected} count={row.total} onClick={() => setSelected(row.id)}>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate">{row.name}</span>
                    {row.scan === "scanning" && <StatusDot state="running" />}
                  </span>
                </NavItem>
              ))}
            </NavGroup>
          </NavRail>
        </div>
        <section aria-label={chosen?.name ?? RAIL_ALL} className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Workspace labels={LABELS}>
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
