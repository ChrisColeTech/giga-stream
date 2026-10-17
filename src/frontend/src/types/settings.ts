import type { Accent, MotionPreference, ThemeMode } from "./shell";

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
  readonly libraryView: "grid" | "list";
  /** The admin backend's address. The interface only edits it through the fileserver; it never contacts it. */
  readonly adminUrl: string;
}

/** The playback preferences: stable choices that apply to every stream, kept in the store and edited in Live's rail. */
export type PlaybackPrefs = Pick<
  Settings,
  "autoplay" | "videoQuality" | "audioLanguage" | "subtitleLanguage" | "lowLatency" | "pictureFit"
>;
