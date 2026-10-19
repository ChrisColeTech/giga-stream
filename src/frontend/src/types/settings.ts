import type { Accent, MotionPreference, ThemeMode } from "./shell";
import type { LibraryMediaTypes } from "./library";

/** How the picture sits in the stage: Fit shows the whole picture, Fill crops it to the stage, Original keeps its own
 *  pixel size (`06` section 3.3). */
export type PictureFit = "fit" | "fill" | "original";

/** The preferred quality, applied to whatever plays: Auto adapts, Higher picks the best level the stream offers, Data
 *  saver the lowest (`03` section 3.2). */
export type VideoQuality = "auto" | "higher" | "saver";

/** Every setting the fileserver stores, with its default (`03` section 3.2). */
export interface Settings {
  readonly theme: ThemeMode;
  readonly themeAccent: Accent;
  readonly reducedMotion: MotionPreference;
  /** 0.5 to 3. */
  readonly uiZoom: number;
  readonly autoplay: boolean;
  readonly videoQuality: VideoQuality;
  /** A BCP-47 tag, or null for the stream's own default track. */
  readonly audioLanguage: string | null;
  /** A BCP-47 tag, or null for captions off. */
  readonly subtitleLanguage: string | null;
  /** Low latency where the stream offers it. */
  readonly lowLatency: boolean;
  readonly pictureFit: PictureFit;
  /** Opening a title left partway: ask (Resume and Start over), always resume, or always start over. */
  readonly resumeMode: "ask" | "resume" | "restart";
  /** How far in a title counts as watched and leaves Continue watching. */
  readonly watchedPercent: 90 | 95 | 100;
  /** What Live does when it opens: start the last channel, or nothing. */
  readonly liveOnOpen: "last" | "none";
  readonly libraryView: "grid" | "list" | "rows";
  readonly librarySort: "newest" | "oldest" | "az" | "year";
  /** Whether Library shows the Continue watching strip. */
  readonly showContinue: boolean;
  /** While on, nothing played is written to History. */
  readonly pauseHistory: boolean;
  /** Rescan every attached folder when the app starts. */
  readonly rescanOnStartup: boolean;
  /** The admin backend's address. The interface only edits it through the fileserver; it never contacts it. */
  readonly adminUrl: string;
  /** The Player source last chosen (`provider:<id>` or `app`), played first wherever an item offers it; null is the
   *  item's first source. */
  readonly defaultSource: string | null;
  /** The Library as the person last left it: the Media picker, the rail view and the filters, the Filter text included
   *  (owner, 2026-10-18). */
  readonly libraryScope: LibraryMediaTypes;
  /** `all`, `history`, `favorites` or `collection:<id>`. */
  readonly librarySource: string;
  readonly libraryGenres: string[];
  /** A four-digit year, or "" for any year. */
  readonly libraryYear: string;
  readonly libraryWatched: "all" | "unwatched" | "watching" | "watched";
  /** The right rail's Filter text, "" for none; it narrows the loaded list by title. */
  readonly libraryFilter: string;
}

/** The playback preferences: stable choices that apply to every stream, kept in the store and edited in Live's rail. */
export type PlaybackPrefs = Pick<
  Settings,
  | "autoplay"
  | "videoQuality"
  | "audioLanguage"
  | "subtitleLanguage"
  | "lowLatency"
  | "pictureFit"
  | "resumeMode"
  | "watchedPercent"
  | "liveOnOpen"
  | "defaultSource"
>;

/** The Library preferences, kept in the store and edited in Settings > Library. */
export type LibraryPrefs = Pick<
  Settings,
  | "libraryView"
  | "librarySort"
  | "showContinue"
  | "pauseHistory"
  | "rescanOnStartup"
  | "libraryScope"
  | "librarySource"
  | "libraryGenres"
  | "libraryYear"
  | "libraryWatched"
  | "libraryFilter"
>;
