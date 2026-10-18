import { createTitlesSlice as createBrowseSlice, type TitlesSlice as BrowseSlice } from "../titles-slice";
import { createTitlesStoredSlice, type TitlesStoredSlice } from "../titles-stored-slice";
import type { SliceGet, SliceSet } from "./slice-host";

/** The Titles tab's slice, registered here (`39` section 5): the TMDB browse list (`titles-slice.ts`) and the stored list
 *  (`titles-stored-slice.ts`, `docs/41` section 5.2), one slice to the registry. A new session resets both; a write's
 *  answer or a delete lands in the browse items and in the stored pages, so neither list shows an old row. */
export { NO_TITLES } from "../titles-slice";
export { NO_STORED, type StoredState, type TitlesMode } from "../titles-stored-slice";
export type TitlesSlice = BrowseSlice & TitlesStoredSlice;

export function createTitlesSlice(set: SliceSet<TitlesSlice>, get: SliceGet<TitlesSlice>): TitlesSlice {
  const browse = createBrowseSlice(set, get);
  const stored = createTitlesStoredSlice(set, get);
  return {
    ...browse,
    ...stored,
    titlesReset: (session) => {
      browse.titlesReset(session);
      stored.storedReset();
    },
    titleUpsert: (title) => {
      browse.titleUpsert(title);
      stored.storedPatch(title);
    },
    titleRemove: (id) => {
      browse.titleRemove(id);
      stored.storedRemove(id);
    },
  };
}
