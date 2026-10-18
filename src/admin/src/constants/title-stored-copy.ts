/* The Stored titles list's words and fixed numbers (`docs/41` sections 4.5, 5.2 and 6). Copy lives here, never in a
 * component. A field carries its own accessible name; there is no text under any control. */

/** Rows per page the bulk resolve reads (the backend's maximum). */
export const RESOLVE_PAGE = 200;

export const VIEW_LABEL = "View";
export const VIEW_OPTIONS = [
  { value: "stored", label: "Stored" },
  { value: "browse", label: "Browse TMDB" },
] as const;
export const VIEW_TIP = "Stored: every title the backend holds. Browse TMDB: what TMDB lists, to find titles the store lacks.";

export const STORED_SEARCH_LABEL = "Search stored titles";
export const STORED_SORT_LABEL = "Sort";

export const STORED_SORT_OPTIONS = [
  { value: "title:asc", label: "Title, A to Z" },
  { value: "title:desc", label: "Title, Z to A" },
  { value: "year:desc", label: "Year, newest" },
  { value: "year:asc", label: "Year, oldest" },
  { value: "rating:desc", label: "Rating, highest" },
  { value: "rating:asc", label: "Rating, lowest" },
  { value: "fetched:desc", label: "Fetched, newest" },
  { value: "fetched:asc", label: "Fetched, oldest" },
] as const;

/** The filter Selects: each leads with its "no filter" option, which names the field. */
export const KIND_SELECT = {
  label: "Kind",
  options: [
    { value: "all", label: "All kinds" },
    { value: "movie", label: "Movies" },
    { value: "tv", label: "Series" },
  ],
} as const;
export const ORIGIN_SELECT = {
  label: "Origin",
  options: [
    { value: "all", label: "All origins" },
    { value: "tmdb", label: "Synced" },
    { value: "manual", label: "Hand-made" },
  ],
} as const;
export const EDITED_SELECT = {
  label: "Edited",
  options: [
    { value: "all", label: "Edited or not" },
    { value: "true", label: "Edited" },
    { value: "false", label: "Not edited" },
  ],
} as const;
export const ENABLED_SELECT = {
  label: "Enabled",
  options: [
    { value: "all", label: "Enabled or not" },
    { value: "true", label: "Enabled" },
    { value: "false", label: "Disabled" },
  ],
} as const;

export const SELECT_LOADED = "Select the rows loaded";
export const selectAllMatching = (count: number): string => `Select all ${count.toLocaleString("en-US")} matching`;
export const SELECT_ALL_TITLES = "Select all titles";
export const RESOLVING_REASON = "Reading the matching titles.";
