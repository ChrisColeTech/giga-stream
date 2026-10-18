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

/** The sort select's columns; the direction is the toggle beside it. */
export const STORED_SORT_OPTIONS = [
  { value: "title", label: "Title" },
  { value: "year", label: "Year" },
  { value: "rating", label: "Rating" },
  { value: "fetched", label: "Fetched" },
] as const;

/** The filter Selects, self-labelling (`QuerySelect`): the face shows `label` at rest, the chosen value otherwise; the
 *  FIRST option is the default, worded for the open list only. */
export const KIND_SELECT = {
  label: "Kind",
  options: [
    { value: "all", label: "Any kind" },
    { value: "movie", label: "Movies" },
    { value: "tv", label: "Series" },
  ],
} as const;
export const ORIGIN_SELECT = {
  label: "Origin",
  options: [
    { value: "all", label: "Any origin" },
    { value: "tmdb", label: "Synced" },
    { value: "manual", label: "Hand-made" },
  ],
} as const;
export const EDITED_SELECT = {
  label: "Edited",
  options: [
    { value: "all", label: "Any edit state" },
    { value: "true", label: "Edited" },
    { value: "false", label: "Not edited" },
  ],
} as const;
export const ENABLED_SELECT = {
  label: "Enabled",
  options: [
    { value: "all", label: "Any state" },
    { value: "true", label: "Enabled" },
    { value: "false", label: "Disabled" },
  ],
} as const;

export const SELECT_LOADED = "Select the rows loaded";
export const selectAllMatching = (count: number): string => `Select all ${count.toLocaleString("en-US")} matching`;
export const SELECT_ALL_TITLES = "Select all titles";
export const RESOLVING_REASON = "Reading the matching titles.";
