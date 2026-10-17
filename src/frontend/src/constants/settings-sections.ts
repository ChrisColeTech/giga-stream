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

/** Every row label Settings renders, across all its sections. Each section's workspace sizes its label column from this
 *  one list, so the column stays put as the rail moves from section to section. A new row's label is added here. */
export const SETTINGS_LABELS: readonly string[] = [
  "Theme",
  "Reduce motion",
  "Accent",
  "UI zoom",
  "Autoplay",
  "Resume",
  "Mark as watched",
  "On open",
  "Default view",
  "Default sort",
  "Continue watching",
  "Pause history",
  "History",
  "Collections",
  "Rescan on startup",
  "Address",
  "Connection",
  "Revision",
  "Channels read",
  "Error",
  "Version and build",
  "Runtime mode",
  "Licences",
  "TMDB",
];

/** UI zoom: 0.5 to 3 in steps of one decimal (`03` section 3.2, `06` section 6.2). `Ctrl+0` resets it to 1 (the shell). */
export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 3;
export const ZOOM_STEP = 0.1;
export const ZOOM_AT_MIN = `The smallest zoom is ${ZOOM_MIN}.`;
export const ZOOM_AT_MAX = `The largest zoom is ${ZOOM_MAX}.`;

/** Why a row that reads the fileserver or the admin backend cannot be used right now. */
export const NEEDS_FILESERVER = "The fileserver is not connected.";

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
