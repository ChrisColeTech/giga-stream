import { NavGroup } from "@giga/ui/lists/NavGroup";
import { NavItem } from "@giga/ui/lists/NavItem";
import { SHIMMER } from "@giga/ui/lib/shimmer";
import { useCollectionVerbs } from "@/hooks/useCollectionVerbs";
import { cn } from "@giga/ui/lib/cn";
import { LIBRARY_COPY } from "@/lib/library-copy";
import { RAIL_SKELETON_ROWS } from "@/lib/library-limits";
import { collectionSource, sortedCollections, type SourceId, type ViewCounts } from "@/lib/library-query";
import { useAppStore } from "@/store/app-store";
import type { CollectionRow } from "@/types/collection";
import { openCollectionMenu } from "./rail-menu";

export interface CollectionsSectionProps {
  readonly source: SourceId;
  readonly collections: readonly CollectionRow[];
  readonly counts: ViewCounts;
  readonly onSource: (source: SourceId) => void;
}

/** The Collections group of the rail: every collection, alphabetical, with its count; while it scans, the count is a shimmer skeleton and the partial number is in the tooltip.
 *  Until there are collections, the group draws shimmer rows in the navigation row's shape. A row's context menu rides
 *  on a wrapper, because the family NavItem takes no menu handler of its own. */
export function CollectionsSection({ source, collections, counts, onSource }: CollectionsSectionProps) {
  const verbs = useCollectionVerbs();
  const openCollections = useAppStore((state) => state.openCollections);
  return (
    <NavGroup heading="Collections">
      {collections.length === 0
        ? Array.from({ length: RAIL_SKELETON_ROWS }, (_, index) => (
            <span key={index} aria-hidden className="flex h-8 items-center pr-2.5 pl-3.5">
              <span className={cn(SHIMMER, "w-[60%]")} />
            </span>
          ))
        : sortedCollections(collections).map((row) => {
            const id = collectionSource(row.id);
            return (
              <div
                key={row.id}
                title={row.scan === "scanning" ? LIBRARY_COPY.scanningSoFar(counts.collections[row.id] ?? 0) : undefined}
                onContextMenu={(event) =>
                  openCollectionMenu(event, () => verbs.attach(row.id), () => openCollections(row.id))
                }
              >
                <NavItem
                  selected={source === id}
                  /* While a scan runs the count is still arriving, so it is a skeleton (loading is a skeleton) the width
                     of a three-digit count, so the edge does not jump when the number lands; the partial number is in
                     the tooltip, which says what it counts. */
                  count={
                    row.scan === "scanning" ? (
                      <span aria-hidden className={cn(SHIMMER, "h-[9px] w-6")} />
                    ) : (
                      (counts.collections[row.id] ?? 0)
                    )
                  }
                  onClick={() => onSource(id)}
                >
                  {row.name}
                  {row.scan === "scanning" && <span className="sr-only">, {LIBRARY_COPY.scanning}</span>}
                </NavItem>
              </div>
            );
          })}
    </NavGroup>
  );
}
