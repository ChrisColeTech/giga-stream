import type { LibraryItem } from "@/types/library";
import type { Episode, TitleDetail } from "@/types/title";

/** PHASE 1 FIXTURE: the library's items, shaped as `03` section 3.5 (`LibraryItem`). Title ids are TMDB's shape
 *  (`movie-603`, `tv-1396`); no poster image is set, so every card draws its fallback glyph. */
export const LIBRARY_ITEMS: readonly LibraryItem[] = [
  { ref: { kind: "title", id: "movie-603" }, kind: "movie", title: "The Matrix", year: 1999, genres: ["Action", "Science Fiction"], favorite: true },
  {
    ref: { kind: "title", id: "movie-27205" },
    kind: "movie",
    title: "Inception",
    year: 2010,
    genres: ["Action", "Science Fiction"],
    favorite: false,
    progress: { positionMs: 1800000, durationMs: 8880000, state: "watching" },
  },
  { ref: { kind: "title", id: "movie-335984" }, kind: "movie", title: "Blade Runner 2049", year: 2017, genres: ["Science Fiction", "Drama"], favorite: false },
  {
    ref: { kind: "title", id: "movie-329865" },
    kind: "movie",
    title: "Arrival",
    year: 2016,
    genres: ["Science Fiction", "Drama"],
    favorite: false,
    progress: { positionMs: 6900000, durationMs: 6900000, state: "watched" },
  },
  { ref: { kind: "title", id: "movie-438631" }, kind: "movie", title: "Dune", year: 2021, genres: ["Science Fiction", "Adventure"], favorite: false },
  { ref: { kind: "title", id: "movie-62" }, kind: "movie", title: "2001: A Space Odyssey", year: 1968, genres: ["Science Fiction"], favorite: false },
  {
    ref: { kind: "title", id: "tv-1396" },
    kind: "tv",
    title: "Breaking Bad",
    year: 2008,
    genres: ["Drama", "Crime"],
    favorite: false,
    progress: { positionMs: 1260000, durationMs: 2820000, state: "watching", season: 1, episode: 2 },
  },
  { ref: { kind: "title", id: "tv-95396" }, kind: "tv", title: "Severance", year: 2022, genres: ["Drama", "Mystery"], favorite: true },
  { ref: { kind: "title", id: "tv-70523" }, kind: "tv", title: "Dark", year: 2017, genres: ["Sci-Fi & Fantasy", "Drama"], favorite: false },
  { ref: { kind: "title", id: "tv-87108" }, kind: "tv", title: "Chernobyl", year: 2019, genres: ["Drama", "History"], favorite: false },
  { ref: { kind: "local", id: "local-1" }, kind: "local", title: "Holiday footage", year: 2025, quality: "1080p", genres: [], favorite: false },
  { ref: { kind: "local", id: "local-2" }, kind: "local", title: "Lecture recording", year: 2024, quality: "720p", genres: [], favorite: true },
];

/** PHASE 1 FIXTURE: title details (`03` section 3.6), keyed by title id. */
export const TITLE_DETAILS: Readonly<Record<string, TitleDetail>> = {
  "movie-603": {
    id: "movie-603",
    kind: "movie",
    title: "The Matrix",
    year: 1999,
    plot: "A computer hacker learns the nature of his reality and his role in the war against its controllers.",
    rating: 8.2,
    genres: ["Action", "Science Fiction"],
    cast: ["Keanu Reeves", "Laurence Fishburne", "Carrie-Anne Moss"],
    runtimeMs: 8160000,
  },
  "movie-27205": {
    id: "movie-27205",
    kind: "movie",
    title: "Inception",
    year: 2010,
    plot: "A thief who steals secrets through dream-sharing is given a task that would plant an idea instead.",
    rating: 8.4,
    genres: ["Action", "Science Fiction"],
    cast: ["Leonardo DiCaprio", "Joseph Gordon-Levitt", "Elliot Page"],
    runtimeMs: 8880000,
  },
  "tv-1396": {
    id: "tv-1396",
    kind: "tv",
    title: "Breaking Bad",
    year: 2008,
    plot: "A chemistry teacher turned manufacturer of methamphetamine partners with a former student.",
    rating: 8.9,
    genres: ["Drama", "Crime"],
    cast: ["Bryan Cranston", "Aaron Paul", "Anna Gunn"],
    seasons: [{ season: 1, episodeCount: 3 }],
  },
  "tv-95396": {
    id: "tv-95396",
    kind: "tv",
    title: "Severance",
    year: 2022,
    plot: "Employees undergo a procedure that separates their work memories from their personal lives.",
    rating: 8.7,
    genres: ["Drama", "Mystery"],
    cast: ["Adam Scott", "Britt Lower", "Zach Cherry"],
    seasons: [{ season: 1, episodeCount: 9 }],
  },
};

/** PHASE 1 FIXTURE: a series' episodes, keyed by title id (`03` section 3.6, `Episode`). */
export const SERIES_EPISODES: Readonly<Record<string, readonly Episode[]>> = {
  "tv-1396": [
    { season: 1, episode: 1, title: "Pilot", runtimeMs: 2820000 },
    { season: 1, episode: 2, title: "Cat's in the Bag...", runtimeMs: 2820000 },
    { season: 1, episode: 3, title: "...And the Bag's in the River", runtimeMs: 2820000 },
  ],
};

/** PHASE 1 FIXTURE: related titles of a title (`03` section 3.6, the related answer), keyed by title id. */
export const RELATED_ITEMS: Readonly<Record<string, readonly LibraryItem[]>> = {
  "movie-603": [
    { ref: { kind: "title", id: "movie-27205" }, kind: "movie", title: "Inception", year: 2010, genres: [], favorite: false },
    { ref: { kind: "title", id: "movie-335984" }, kind: "movie", title: "Blade Runner 2049", year: 2017, genres: [], favorite: false },
    { ref: { kind: "title", id: "movie-329865" }, kind: "movie", title: "Arrival", year: 2016, genres: [], favorite: false },
    { ref: { kind: "title", id: "movie-438631" }, kind: "movie", title: "Dune", year: 2021, genres: [], favorite: false },
  ],
};
