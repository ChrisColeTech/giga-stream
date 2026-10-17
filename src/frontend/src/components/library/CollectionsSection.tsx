import { NavGroup, NavItem } from "@/components/ui/NavRail";
import { SHIMMER } from "@/components/ui/SkeletonRows";
import { LoaderCircle } from "lucide-react";
import { useCollectionVerbs } from "@/hooks/useCollectionVerbs";
import { useReduceMotion } from "@/hooks/useReduceMotion";
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

/** The Collections group of the rail: every collection, alphabetical, with its count, and a small turning loader before the count while it scans.
 *  Until there are collections, the group draws shimmer rows in the navigation row's shape. A row's context menu rides
 *  on a wrapper, because the family NavItem takes no menu handler of its own. */
export function CollectionsSection({ source, collections, counts, onSource }: CollectionsSectionProps) {
  const verbs = useCollectionVerbs();
  const reduce = useReduceMotion();
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
                title={row.scan === "scanning" ? LIBRARY_COPY.scanning : undefined}
                onContextMenu={(event) => openCollectionMenu(event, () => verbs.attach(row.id))}
              >
                <NavItem
                  selected={source === id}
                  /* A scan is a small turning loader before the count, in the count's own dim color and size: the row
                     keeps its name, count and selection bar, and nothing else on it moves. */
                  count={
                    row.scan === "scanning" ? (
                      <span className="inline-flex items-center gap-1.5">
                        <LoaderCircle className={cn("size-3", !reduce && "animate-spin")} aria-hidden />
                        {counts.collections[row.id] ?? 0}
                      </span>
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
