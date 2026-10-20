import { NavRail } from "@giga/ui/lists/NavRail";
import type { SourceId, ViewCounts } from "@/lib/library-query";
import type { CollectionRow } from "@/types/collection";
import { CollectionsFooter } from "./CollectionsFooter";
import { CollectionsSection } from "./CollectionsSection";
import { ViewsSection } from "./ViewsSection";

export interface LibraryRailProps {
  readonly source: SourceId;
  /** The session decides the account's groups (`63` section 3.4): signed out the Collections group, its footer and
   *  the History view are unrendered. */
  readonly signedIn: boolean;
  readonly counts: ViewCounts;
  readonly collections: readonly CollectionRow[];
  readonly onSource: (source: SourceId) => void;
}

/** The left pane of Library, on the family navigation rail (LoRA Studio's GalleryNav): the Views and Collections groups,
 *  and the Manage collections footer pinned at the foot. */
export function LibraryRail({ source, signedIn, counts, collections, onSource }: LibraryRailProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <NavRail ariaLabel="Library">
        <ViewsSection source={source} signedIn={signedIn} counts={counts} onSource={onSource} />
        {signedIn && (
          <CollectionsSection source={source} collections={collections} counts={counts} onSource={onSource} />
        )}
      </NavRail>
      {signedIn && <CollectionsFooter />}
    </div>
  );
}
