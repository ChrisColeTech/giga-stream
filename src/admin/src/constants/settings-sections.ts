import { Info, Palette, User } from "lucide-react";
import type { SettingsSection } from "@giga/ui/windows/SettingsRail";
import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from "@giga/ui/lib/settings-zoom";
import type { ChromeDefaults } from "@giga/ui/store/chrome-slice";

export type SettingsSectionId = "appearance" | "session" | "about";

/** Settings' rail, top to bottom (`26` section 4.2): three pages. The Account page is gone (docs/54): the security
 *  question is set per account in the Accounts workspace. */
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
  "Version",
  "Backend version",
  "Backend revision",
  "Address",
  "Runtime",
  "TMDB",
];

/** The appearance a fresh load starts from, and what `Restore defaults` returns to (`26` D16: saving is Wave 7). */
export const APPEARANCE_DEFAULTS = {
  theme: "dark",
  accent: "amber",
  motion: "off",
  uiZoom: 1,
} as const satisfies ChromeDefaults;

/** UI zoom: 0.5 to 3 in steps of one decimal. `Ctrl+0` resets it to 1 (the shell). */
export { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP };
export const ZOOM_AT_MIN = `The smallest zoom is ${ZOOM_MIN}.`;
export const ZOOM_AT_MAX = `The largest zoom is ${ZOOM_MAX}.`;

/** A fact the page cannot supply, drawn in place of its value, with the reason as its tooltip. */
export const FACT_UNKNOWN = "—";
export const NOT_SIGNED_IN = "You are not signed in.";

/** The tips on the Appearance rows (`01` section 9: an explanation is a tooltip, never text under a control). */
export const APPEARANCE_TIPS = {
  theme: "Light or dark colors for the whole app.",
  motion: "Off keeps panels and sections sliding; On skips every animation.",
  accent: "The highlight color for selection, focus, progress and the one main button on each screen.",
  zoom: "Scales the whole app, from 0.5 to 3. Ctrl+0 resets it to 1.",
} as const;

/** The tips on the About rows and the Session row. */
export const ABOUT_TIPS = {
  version: "The version of this admin app.",
  backendVersion: "The version of the admin backend this app talks to.",
  backendRevision: "The revision of the backend's source it was built from.",
  address: "The address this page was loaded from.",
  runtime: "Electron in the backend's own window, or a browser tab.",
  tmdb: "Whether the backend has a TMDB key to sync the catalog with.",
  signedInAs: "The account this window is signed in with.",
} as const;

export const RESTORE_AT_DEFAULTS = "Appearance is already at its defaults.";
export const RESTORE_TITLE = "Dark, Off, Amber and a zoom of 1";

/** This admin app's version, shown in About. The backend's facts are dashes until `services/health.ts` is wired. */
export const APP_VERSION = "0.1.0";
