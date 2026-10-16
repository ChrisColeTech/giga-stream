import type { Accent, MotionPreference, ThemeMode } from "./shell";

/** Every setting the fileserver stores, with its default (`03` section 3.2). */
export interface Settings {
  readonly theme: ThemeMode;
  readonly themeAccent: Accent;
  readonly reducedMotion: MotionPreference;
  /** 0.5 to 3. */
  readonly uiZoom: number;
  readonly autoplay: boolean;
  /** A BCP-47 tag, or null. */
  readonly subtitleLanguage: string | null;
  readonly libraryView: "grid" | "list";
  /** The admin backend's address. The interface only edits it through the fileserver; it never contacts it. */
  readonly adminUrl: string;
}
