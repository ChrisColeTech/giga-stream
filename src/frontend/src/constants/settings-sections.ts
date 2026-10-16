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

/** One row a section lists before the piece behind it exists: what it is, what it does, and why it cannot be used yet. */
export interface PendingRow {
  readonly label: string;
  readonly tip: string;
  readonly reason: string;
}

/** The rows of every section but Appearance, each disabled with its refusal sentence until the piece it needs lands. */
export const PENDING_ROWS: Readonly<Record<Exclude<SettingsSectionId, "appearance">, readonly PendingRow[]>> = {
  playback: [
    { label: "Autoplay", tip: "Start the next episode when one ends.", reason: "Playback settings arrive with the fileserver link." },
    { label: "Subtitle language", tip: "The caption language chosen when a stream offers several.", reason: "Playback settings arrive with the fileserver link." },
  ],
  library: [
    { label: "Default view", tip: "Show the library as a grid or a list.", reason: "The library arrives with the library service." },
    { label: "Collections", tip: "Open the collections window.", reason: "The library arrives with the library service." },
  ],
  admin: [
    { label: "Address", tip: "Where the admin backend is, as the fileserver reaches it.", reason: "The fileserver link is not wired yet." },
  ],
  about: [
    { label: "Version", tip: "The version of this app.", reason: "The fileserver link is not wired yet." },
    { label: "Data sources", tip: "Where titles and artwork come from, with the attribution their terms require.", reason: "The fileserver link is not wired yet." },
  ],
};
