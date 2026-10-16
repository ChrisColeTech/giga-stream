import { Eye, HardDrive, Info, Library, Play } from "lucide-react";
import type { ComponentType } from "react";

export type SettingsSectionId = "appearance" | "playback" | "library" | "admin" | "about";

export interface SettingsSection {
  readonly id: SettingsSectionId;
  readonly label: string;
  readonly icon: ComponentType<{ className?: string }>;
}

/** Settings' rail, top to bottom (`06` section 6.2). There is no provider section: providers belong to the backend. */
export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  { id: "appearance", label: "Appearance", icon: Eye },
  { id: "playback", label: "Playback", icon: Play },
  { id: "library", label: "Library", icon: Library },
  { id: "admin", label: "Admin backend", icon: HardDrive },
  { id: "about", label: "About", icon: Info },
];

/** UI zoom: 0.5 to 3 in steps of one decimal (`03` section 3.2, `06` section 6.2). `Ctrl+0` resets it to 1 (the shell). */
export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 3;
export const ZOOM_STEP = 0.1;
export const ZOOM_AT_MIN = `The smallest zoom is ${ZOOM_MIN}.`;
export const ZOOM_AT_MAX = `The largest zoom is ${ZOOM_MAX}.`;

/** Why a row that reads the fileserver or the admin backend cannot be used in phase 1 (`21` section 1). */
export const NEEDS_FILESERVER = "Available once the fileserver is connected.";

/** Why the TMDB logo placeholder is disabled: the file is not in the repository yet (`11` section 6). */
export const LOGO_MISSING = "The TMDB logo is not in the repository yet.";

/** A fact the fileserver has not supplied yet, drawn in place of its value. */
export const FACT_UNKNOWN = "—";

/** The notice TMDB's terms require beside its logo (`11` section 6). */
export const TMDB_NOTICE =
  "This product uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.";

/** The subtitle select's off choice. Its value stands for the stored `null` (`03` section 3.2). */
export const SUBTITLE_OFF = "off";

export interface LanguageOption {
  readonly value: string;
  readonly label: string;
}

/** The caption languages the select offers in phase 1: a short list of BCP-47 tags, with the off choice first. */
export const SUBTITLE_LANGUAGES: readonly LanguageOption[] = [
  { value: SUBTITLE_OFF, label: "Off" },
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "ja", label: "Japanese" },
];
