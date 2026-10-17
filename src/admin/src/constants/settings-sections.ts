import { Info, Palette, User } from "lucide-react";
import type { SettingsSection } from "@giga/ui/windows/SettingsRail";
import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from "@giga/ui/lib/settings-zoom";
import type { ChromeDefaults } from "@giga/ui/store/chrome-slice";

export type SettingsSectionId = "appearance" | "session" | "about";

/** Settings' rail, top to bottom (`28` section 7.1): the admin has three pages. */
export const SETTINGS_SECTIONS: readonly SettingsSection<SettingsSectionId>[] = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "session", label: "Session", icon: User },
  { id: "about", label: "About", icon: Info },
];

/** Every row label Settings renders, across all three pages. The frame sizes one label column from the longest, so the
 *  column stays put as the rail moves from page to page. A new row's label is added here. */
export const SETTINGS_LABELS: readonly string[] = [
  "Theme",
  "Reduce motion",
  "Accent",
  "UI zoom",
  "Signed in as",
  "Name",
  "Version",
  "Backend version",
  "Backend revision",
  "Address",
  "Runtime",
  "TMDB",
];

/** The appearance a fresh load starts from, and what `Restore defaults` returns to (`26` D16: saving is Wave 7). */
export const APPEARANCE_DEFAULTS: ChromeDefaults = { theme: "dark", accent: "amber", motion: "system", uiZoom: 1 };

/** UI zoom: 0.5 to 3 in steps of one decimal. `Ctrl+0` resets it to 1 (the shell). */
export { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP };
export const ZOOM_AT_MIN = `The smallest zoom is ${ZOOM_MIN}.`;
export const ZOOM_AT_MAX = `The largest zoom is ${ZOOM_MAX}.`;

/** A fact the page cannot supply, drawn in place of its value, with the reason as its tooltip. */
export const FACT_UNKNOWN = "—";
export const NOT_SIGNED_IN = "You are not signed in.";

export const RESTORE_AT_DEFAULTS = "Appearance is already at its defaults.";
export const RESTORE_TITLE = "Dark, Follow system, Amber and a zoom of 1";
