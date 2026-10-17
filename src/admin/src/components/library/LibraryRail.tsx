import { NavRail } from "@/components/ui/NavRail";
import type { SourceId, ViewCounts } from "@/lib/library-query";
import type { CollectionRow } from "@/types/collection";
import { CollectionsFooter } from "./CollectionsFooter";
import { CollectionsSection } from "./CollectionsSection";
import { ViewsSection } from "./ViewsSection";

export interface LibraryRailProps {
  readonly source: SourceId;
  readonly counts: ViewCounts;
  readonly collections: readonly CollectionRow[];
  readonly onSource: (source: SourceId) => void;
}

/** The left pane of Library, on the family navigation rail (LoRA Studio's GalleryNav): the Views and Collections groups,
 *  and the Manage collections footer pinned at the foot. */
export function LibraryRail({ source, counts, collections, onSource }: LibraryRailProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <NavRail ariaLabel="Library">
        <ViewsSection source={source} counts={counts} onSource={onSource} />
        <CollectionsSection source={source} collections={collections} counts={counts} onSource={onSource} />
      </NavRail>
      <CollectionsFooter />
    </div>
  );
}
