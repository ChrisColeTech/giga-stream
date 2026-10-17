import { RailRow } from "@/components/ui/RailRow";
import { RailSection } from "@/components/ui/RailSection";
import { SkeletonRows } from "@/components/ui/SkeletonRows";
import { RAIL_SKELETON_ROWS } from "@/lib/library-limits";
import { collectionSource, sortedCollections, type SourceId, type ViewCounts } from "@/lib/library-query";
import type { CollectionRow } from "@/types/collection";
import { FolderGlyph } from "./FolderGlyph";
import { openCollectionMenu } from "./rail-menu";
import { ScanFolderGlyph } from "./ScanFolderGlyph";

export interface CollectionsSectionProps {
  readonly source: SourceId;
  readonly collections: readonly CollectionRow[];
  readonly counts: ViewCounts;
  readonly onSource: (source: SourceId) => void;
}

/** The Collections group of the rail: every collection, alphabetical, with its count and a scan dot while it scans.
 *  Until there are collections, the group draws skeleton rows. */
export function CollectionsSection({ source, collections, counts, onSource }: CollectionsSectionProps) {
  return (
    <RailSection id="library.collections" title="Collections">
      {collections.length === 0 ? (
        <SkeletonRows count={RAIL_SKELETON_ROWS} />
      ) : (
        sortedCollections(collections).map((row) => {
          const id = collectionSource(row.id);
          return (
            <RailRow
              key={row.id}
              label={row.name}
              icon={row.scan === "scanning" ? ScanFolderGlyph : FolderGlyph}
              count={counts.collections[row.id] ?? 0}
              selected={source === id}
              onSelect={() => onSource(id)}
              onContextMenu={openCollectionMenu}
            />
          );
        })
      )}
    </RailSection>
  );
}
