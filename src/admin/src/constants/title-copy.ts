/* The Titles tab's words (`37` section 4; the mockup's tips, `28` section 7.3): labels, tips, disabled reasons and
 * notices. Copy lives here, never in a component. */

/** The index's label column: the New form's rows and the list's filter rows. */
export const TITLES_INDEX_LABELS: readonly string[] = ["Title", "Kind", "Year", "Search", "Sort"];
export const TITLE_WORKSPACE_LABELS: readonly string[] = [
  "Title",
  "Kind",
  "Year",
  "Enabled",
  "TMDB id",
  "Rating",
  "Genres",
  "Runtime",
  "Poster address",
  "Backdrop address",
  "Stream address",
  "State",
  "Plot",
  "Cast",
  "Season",
  "Episode",
];

export const TITLE_SECTIONS_MOVIE = [
  { id: "tw-details", label: "Details" },
  { id: "tw-people", label: "People and plot" },
  { id: "tw-sources", label: "Sources" },
] as const;
export const TITLE_SECTIONS_SERIES = [
  { id: "tw-details", label: "Details" },
  { id: "tw-people", label: "People and plot" },
  { id: "tw-seasons", label: "Seasons" },
  { id: "tw-sources", label: "Sources" },
] as const;
export const TITLE_KEYS_MOVIE: readonly string[] = TITLE_SECTIONS_MOVIE.map((section) => section.id);
export const TITLE_KEYS_SERIES: readonly string[] = TITLE_SECTIONS_SERIES.map((section) => section.id);

export const KIND_OPTIONS = [
  { value: "movie", label: "Movie" },
  { value: "tv", label: "Series" },
] as const;
export const KIND_CHIPS = [
  { value: "movie", label: "Movies" },
  { value: "tv", label: "Series" },
] as const;
export const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "az", label: "A-Z" },
  { value: "year", label: "Year" },
  { value: "trending", label: "Trending" },
] as const;

/** Info tips (the mockup's sentences). */
export const KIND_NEW_TIP = "A movie or a series. Fixed once the title exists.";
export const KIND_FIXED_TIP = "Fixed once the title exists.";
export const YEAR_TIP = "The year it was first released.";
export const SEARCH_TIP = "Searches TMDB and the titles made here. Press Enter or the search button.";
export const KIND_FILTER_TIP = "Which kinds the list shows; at least one stays on.";
export const SORT_TIP = "The order of the list. A search keeps the order TMDB answers in.";
export const ENABLED_TIP = "A disabled title stays in the list but is left out of what the player app reads.";
export const TMDB_ID_TIP = "With a TMDB id, the providers can produce sources for this title.";
export const TMDB_ID_FIXED_TIP = "A title from TMDB keeps its TMDB id.";
export const RATING_TIP = "A score from 0 to 10.";
export const GENRES_TIP = "Separate genres with commas.";
export const RUNTIME_TIP = "Minutes. A movie has one; a series has its seasons.";
export const POSTER_TIP = "The picture shown for the title in lists; an https address.";
export const BACKDROP_TIP = "The wide picture shown behind the title; an https address.";
export const STREAM_TIP = "Optional. A direct stream address for this title; it must pass the address rule.";
export const STATE_TIP = "synced, edited (a sync keeps your edits), manual (made here) or disabled.";
export const CAST_TIP = "Names separated by commas.";
export const REVERT_TIP = "Drop the edits and refetch this title from TMDB";
export const DELETE_MANUAL_TITLE = "Deletes the title made here.";
export const DELETE_SYNCED_TITLE =
  "Deletes the title and keeps it deleted: no browse or catalog sync adds it back. Restore it under Deleted titles.";
export const RESTORE_TITLE = "Lets the title return on the next browse or sync.";

/** Disabled reasons. */
export const MANUAL_NO_TMDB = "A title made by hand has no TMDB copy to go back to.";
export const NOTHING_EDITED = "Nothing was edited.";
export const SAVING_REASON = "Saving.";
export const LOADING_REASON = "Loading.";
export const UNREACHABLE_REASON = "The admin backend cannot be reached.";
export const SEARCH_LABEL = "Search titles";

/** Value refusals (`37` section 4.1, `types/title-input.ts`). */
export const TITLE_TOO_LONG = "Title must be at most 200 characters.";
export const GENRES_TOO_MANY = "At most 20 genres.";
export const CAST_TOO_MANY = "At most 50 names in the cast.";
export const SEASONS_TOO_MANY = "At most 100 seasons of 500 episodes.";
export const SEASON_TAKEN = "Each season number is used once.";

/** Notices. */
export const TITLE_GONE = "That title no longer exists.";
export const titleCreated = (name: string): string => `Created ${name}.`;
export const titleSaved = (name: string): string => `Saved ${name}.`;
export const titleDeleted = (name: string): string => `Deleted ${name}.`;
export const titleReverted = (name: string): string => `Reverted ${name} to TMDB.`;
export const titleRestored = (name: string): string => `Restored ${name}. It returns on the next browse or sync.`;
export const unreadableTitles = (count: number): string =>
  `${count} ${count === 1 ? "title" : "titles"} could not be read.`;
export const editedTip = (fields: readonly string[]): string => `edited: ${fields.join(", ")}`;

/** The bulk verbs (`37` section 4.2). */
export const ALREADY_ENABLED = "Already enabled.";
export const ALREADY_DISABLED = "Already disabled.";
export const SYNCED_STAY = "stay deleted until restored under Deleted titles";
export const SYNCED_STAYS = "stays deleted until restored under Deleted titles";

/** The Deleted titles group (`37` section 4.4): its heading, the verbs' tips, and the bulk Restore's noun. */
export const DELETED_TITLES = "Deleted titles";
export const RESTORE_RETURN_ONE = "it returns on the next browse or sync";
export const RESTORE_RETURN_MANY = "they return on the next browse or sync";
