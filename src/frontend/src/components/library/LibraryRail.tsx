import { NavRail } from "@giga/ui/lists/NavRail";
import type { LibraryQuery, ViewCounts } from "@/lib/library-query";
import type { CollectionRow } from "@/types/collection";
import { CategoriesSection } from "./CategoriesSection";
import { CollectionsFooter } from "./CollectionsFooter";
import { CollectionsSection } from "./CollectionsSection";

export interface LibraryRailProps {
  readonly query: LibraryQuery;
  /** The session decides the account's groups (`63` section 3.4): signed out the Collections group, its footer and
   *  the History view are unrendered. */
  readonly signedIn: boolean;
  readonly counts: ViewCounts;
  readonly collections: readonly CollectionRow[];
  readonly genres: readonly string[];
  readonly onQuery: (change: Partial<LibraryQuery>) => void;
}

/** The Library's Categories and signed-in Collections groups, with its management footer pinned at the foot. */
export function LibraryRail({ query, signedIn, counts, collections, genres, onQuery }: LibraryRailProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <NavRail ariaLabel="Library">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <CategoriesSection query={query} signedIn={signedIn} genres={genres} counts={counts} onQuery={onQuery} />
          {signedIn && (
            <CollectionsSection source={query.source} collections={collections} counts={counts}
              onSource={(source) => onQuery({ source })} />
          )}
        </div>
      </NavRail>
      {signedIn && <CollectionsFooter />}
    </div>
  );
}
