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

/** The left pane of Library: the Views and Collections groups, and the Manage collections footer pinned at the foot. */
export function LibraryRail({ source, counts, collections, onSource }: LibraryRailProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col py-1.5">
        <ViewsSection source={source} counts={counts} onSource={onSource} />
        <CollectionsSection source={source} collections={collections} counts={counts} onSource={onSource} />
      </div>
      <CollectionsFooter />
    </div>
  );
}
