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
  libraryView: "grid" | "list";
  subtitleLanguage: string | null;
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
  libraryView: z.enum(["grid", "list"]),
  subtitleLanguage: z.string().min(2).max(35).nullable(),
  adminUrl: z.string().min(1).max(2048),
};

export const SETTING_DEFAULTS: Readonly<Settings> = Object.freeze({
  autoplay: false,
  theme: "dark",
  themeAccent: "amber",
  reducedMotion: "system",
  uiZoom: 1,
  libraryView: "grid",
  subtitleLanguage: null,
  adminUrl: "http://127.0.0.1:8091",
});

export const SETTING_KEYS = Object.keys(SETTING_SCHEMAS) as SettingKey[];

export const SETTING_INVALID_MESSAGES: { [K in SettingKey]: string } = {
  autoplay: "Autoplay must be on or off.",
  theme: "Theme must be dark, light or system.",
  themeAccent: "Accent must be amber, blue, green, violet or rose.",
  reducedMotion: "Reduced motion must be system, off or on.",
  uiZoom: "Zoom must be 0.5 to 3.",
  libraryView: "Library view must be grid or list.",
  subtitleLanguage: "Subtitle language must be a language tag or empty.",
  adminUrl: "The admin address must be a full http(s) URL.",
};
