/** The Library's words and option lists (`06` section 4). Reasons are tooltips on the control, never text under it. */

export const LIBRARY_COPY = {
  renameInManage: "Rename it in Manage collections.",
  removeInManage: "Remove it in Manage collections. Original files remain untouched.",
  noWatchEntry: "No watch entry is loaded for this title.",
  noItem: "No title is open.",
  favorite: "Favorite",
  unfavorite: "Unfavorite",
  removeWatch: "Remove from History",
  clearIdle: "Clear history",
  clearArmed: "Clear all history",
  clearHint: "Press again within four seconds to clear the history.",
  clearEmpty: "The history is already empty.",
  searchClear: "Clear the search",
  searchEmpty: "There is no search to clear.",
  anyGenre: "Any genre",
  anyYear: "Any year",
  collectionsWindow: "Manage collections",
  scanning: "Scanning folders",
  /** The tooltip of a scanning collection: what its partial count is of. */
  scanningSoFar: (videos: number): string => `Scanning folders · ${videos} ${videos === 1 ? "video" : "videos"} so far`,
  watched: "Watched",
  moreActions: "More actions",
  play: "Play",
  open: "Open",
  info: "Info",
  rating: "Rating",
  seasonsNone: "No seasons",
  cast: "Cast",
  plot: "Plot",
  runtime: "Runtime",
  seasons: "Seasons",
  continueHeading: "Continue watching",
  listLabel: "Titles",
} as const;

export interface LibraryOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

export const SCOPE_OPTIONS: readonly LibraryOption<"all" | "movie" | "tv" | "local">[] = [
  { value: "all", label: "All" },
  { value: "movie", label: "Movies" },
  { value: "tv", label: "TV" },
  { value: "local", label: "Local" },
];

/** Trending is not offered in phase 1 (`06` section 4.3: only with a real popularity signal from the backend). */
export const SORT_OPTIONS: readonly LibraryOption<"newest" | "oldest" | "az" | "year">[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "az", label: "A to Z" },
  { value: "year", label: "Year" },
];

export const WATCHED_OPTIONS: readonly LibraryOption<"all" | "unwatched" | "watching" | "watched">[] = [
  { value: "all", label: "All" },
  { value: "unwatched", label: "Unwatched" },
  { value: "watching", label: "Watching" },
  { value: "watched", label: "Watched" },
];
