import { z } from "zod";

import { ALL_LIBRARY_MEDIA, type LibraryMediaTypes } from "./library.js";

/**
 * `Settings` (docs/03 section 3.2), its per-key grammar and defaults. A stored key this build does
 * not know is ignored; a stored value that no longer validates reads as its default.
 */
export interface Settings {
  autoplay: boolean;
  theme: "dark" | "light";
  themeAccent: "amber" | "blue" | "green" | "violet" | "rose";
  reducedMotion: "off" | "on";
  uiZoom: number;
  videoQuality: "auto" | "higher" | "saver";
  audioLanguage: string | null;
  lowLatency: boolean;
  pictureFit: "fit" | "fill" | "original";
  resumeMode: "ask" | "resume" | "restart";
  /** The share of the duration where an entry becomes `watched` (3.13; the table wins over prose). */
  watchedPercent: 90 | 95 | 100;
  liveOnOpen: "last" | "none";
  libraryView: "grid" | "list" | "rows";
  librarySort: "newest" | "oldest" | "az" | "year";
  showContinue: boolean;
  subtitleLanguage: string | null;
  pauseHistory: boolean;
  rescanOnStartup: boolean;
  adminUrl: string;
  /** The Player's source the person last chose (`provider:<id>` or `app`); null plays an item's first source. */
  defaultSource: string | null;
  /** The Library's Type strip, rail view and filters as the person last left them, the Filter text included (owner,
   *  2026-10-18). */
  libraryScope: LibraryMediaTypes;
  librarySource: string;
  libraryGenres: string[];
  /** A four-digit year, or "" for any year. */
  libraryYear: string;
  libraryWatched: "all" | "unwatched" | "watching" | "watched";
  /** The Library's Filter text (it narrows the loaded list by title), "" for none. */
  libraryFilter: string;
}

export type SettingKey = keyof Settings;

const LibraryScopeSchema = z.union([
  z.tuple([z.literal("movie")]),
  z.tuple([z.literal("tv")]),
  z.tuple([z.literal("local")]),
  z.tuple([z.literal("movie"), z.literal("tv")]),
  z.tuple([z.literal("movie"), z.literal("local")]),
  z.tuple([z.literal("tv"), z.literal("local")]),
  z.tuple([z.literal("movie"), z.literal("tv"), z.literal("local")]),
]);

/** One validator per key; a row is checked on its own, never as part of a whole object. */
export const SETTING_SCHEMAS: { [K in SettingKey]: z.ZodType<Settings[K]> } = {
  autoplay: z.boolean(),
  theme: z.enum(["dark", "light"]),
  themeAccent: z.enum(["amber", "blue", "green", "violet", "rose"]),
  reducedMotion: z.enum(["off", "on"]),
  uiZoom: z.number().min(0.5).max(3),
  videoQuality: z.enum(["auto", "higher", "saver"]),
  audioLanguage: z.string().min(2).max(35).nullable(),
  lowLatency: z.boolean(),
  pictureFit: z.enum(["fit", "fill", "original"]),
  resumeMode: z.enum(["ask", "resume", "restart"]),
  watchedPercent: z.union([z.literal(90), z.literal(95), z.literal(100)]),
  liveOnOpen: z.enum(["last", "none"]),
  libraryView: z.enum(["grid", "list", "rows"]),
  librarySort: z.enum(["newest", "oldest", "az", "year"]),
  showContinue: z.boolean(),
  subtitleLanguage: z.string().min(2).max(35).nullable(),
  pauseHistory: z.boolean(),
  rescanOnStartup: z.boolean(),
  adminUrl: z.string().min(1).max(2048),
  defaultSource: z.string().min(1).max(200).nullable(),
  libraryScope: LibraryScopeSchema,
  librarySource: z.string().regex(/^(all|history|favorites|collection:.{1,100})$/),
  libraryGenres: z.array(z.string().min(1).max(80)).max(40),
  libraryYear: z.string().regex(/^(1[89]\d\d|2[01]\d\d)?$/),
  libraryWatched: z.enum(["all", "unwatched", "watching", "watched"]),
  /* The same bound as the Library read's `q` (routes/library.ts). */
  libraryFilter: z.string().max(200),
};

export const SETTING_DEFAULTS: Readonly<Settings> = Object.freeze({
  autoplay: false,
  theme: "dark",
  themeAccent: "amber",
  reducedMotion: "off",
  uiZoom: 1,
  videoQuality: "auto",
  audioLanguage: null,
  lowLatency: false,
  pictureFit: "fit",
  resumeMode: "ask",
  watchedPercent: 90,
  liveOnOpen: "last",
  libraryView: "grid",
  librarySort: "newest",
  showContinue: true,
  subtitleLanguage: null,
  pauseHistory: false,
  rescanOnStartup: true,
  adminUrl: "http://127.0.0.1:8091",
  defaultSource: null,
  libraryScope: ALL_LIBRARY_MEDIA,
  librarySource: "all",
  libraryGenres: [],
  libraryYear: "",
  libraryWatched: "all",
  libraryFilter: "",
});

export const SETTING_KEYS = Object.keys(SETTING_SCHEMAS) as SettingKey[];

export const SETTING_INVALID_MESSAGES: { [K in SettingKey]: string } = {
  autoplay: "Autoplay must be on or off.",
  theme: "Theme must be dark or light.",
  themeAccent: "Accent must be amber, blue, green, violet or rose.",
  reducedMotion: "Reduced motion must be off or on.",
  uiZoom: "Zoom must be 0.5 to 3.",
  videoQuality: "Video quality must be auto, higher or saver.",
  audioLanguage: "Audio language must be a language tag or empty.",
  lowLatency: "Low latency must be on or off.",
  pictureFit: "Picture fit must be fit, fill or original.",
  resumeMode: "Resume must be ask, resume or restart.",
  watchedPercent: "Watched percent must be 90, 95 or 100.",
  liveOnOpen: "Live on open must be last or none.",
  libraryView: "Library view must be grid, list or rows.",
  librarySort: "Library sort must be newest, oldest, az or year.",
  showContinue: "Show Continue must be on or off.",
  subtitleLanguage: "Subtitle language must be a language tag or empty.",
  pauseHistory: "Pause history must be on or off.",
  rescanOnStartup: "Rescan on startup must be on or off.",
  adminUrl: "The admin address must be a full http(s) URL.",
  defaultSource: "The default source must be a source name or empty.",
  libraryScope: "Library media must be a canonical non-empty list of movie, tv and local.",
  librarySource: "Library source must be all, history, favorites or a collection.",
  libraryGenres: "Library genres must be a list of genre names.",
  libraryYear: "Library year must be a four-digit year or empty.",
  libraryWatched: "Library watched must be all, unwatched, watching or watched.",
  libraryFilter: "The Library filter must be text of at most 200 characters.",
};
