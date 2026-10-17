import { NavGroup, NavItem } from "@/components/ui/NavRail";
import { SHIMMER } from "@/components/ui/SkeletonRows";
import { StatusDot } from "@/components/ui/StatusDot";
import { cn } from "@/lib/cn";
import { LIBRARY_COPY } from "@/lib/library-copy";
import { RAIL_SKELETON_ROWS } from "@/lib/library-limits";
import { collectionSource, sortedCollections, type SourceId, type ViewCounts } from "@/lib/library-query";
import type { CollectionRow } from "@/types/collection";
import { openCollectionMenu } from "./rail-menu";

export interface CollectionsSectionProps {
  readonly source: SourceId;
  readonly collections: readonly CollectionRow[];
  readonly counts: ViewCounts;
  readonly onSource: (source: SourceId) => void;
}

/** The Collections group of the rail: every collection, alphabetical, with its count and a scan dot while it scans.
 *  Until there are collections, the group draws shimmer rows in the navigation row's shape. A row's context menu rides
 *  on a `contents` wrapper, because the family NavItem takes no menu handler of its own. */
export function CollectionsSection({ source, collections, counts, onSource }: CollectionsSectionProps) {
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
              <div key={row.id} className="contents" onContextMenu={openCollectionMenu}>
                <NavItem selected={source === id} count={counts.collections[row.id] ?? 0} onClick={() => onSource(id)}>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate">{row.name}</span>
                    {row.scan === "scanning" && (
                      <span title={LIBRARY_COPY.scanning} className="inline-flex">
                        <StatusDot state="loading" />
                      </span>
                    )}
                  </span>
                </NavItem>
              </div>
            );
          })}
    </NavGroup>
  );
}
