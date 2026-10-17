import { z } from "zod";

/**
 * `Settings` (docs/03 section 3.2), its per-key grammar and defaults. A stored key this build does
 * not know is ignored; a stored value that no longer validates reads as its default.
 */
export interface Settings {
  autoplay: boolean;
  theme: "dark" | "light" | "system";
  themeAccent: "amber" | "blue" | "green" | "violet" | "rose";
  reducedMotion: "system" | "off" | "on";
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
}

export type SettingKey = keyof Settings;

/** One validator per key; a row is checked on its own, never as part of a whole object. */
export const SETTING_SCHEMAS: { [K in SettingKey]: z.ZodType<Settings[K]> } = {
  autoplay: z.boolean(),
  theme: z.enum(["dark", "light", "system"]),
  themeAccent: z.enum(["amber", "blue", "green", "violet", "rose"]),
  reducedMotion: z.enum(["system", "off", "on"]),
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
};

export const SETTING_DEFAULTS: Readonly<Settings> = Object.freeze({
  autoplay: false,
  theme: "dark",
  themeAccent: "amber",
  reducedMotion: "system",
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
});

export const SETTING_KEYS = Object.keys(SETTING_SCHEMAS) as SettingKey[];

export const SETTING_INVALID_MESSAGES: { [K in SettingKey]: string } = {
  autoplay: "Autoplay must be on or off.",
  theme: "Theme must be dark, light or system.",
  themeAccent: "Accent must be amber, blue, green, violet or rose.",
  reducedMotion: "Reduced motion must be system, off or on.",
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
};
