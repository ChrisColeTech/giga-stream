import type { Settings } from "@/types/settings";
import { ALL_MEDIA } from "@/lib/library-media";

/** The fileserver defaults (`03` section 3.2), used until its saved settings arrive. */
export const DEFAULT_SETTINGS: Readonly<Settings> = {
  theme: "dark",
  themeAccent: "amber",
  reducedMotion: "off",
  uiZoom: 1,
  autoplay: false,
  videoQuality: "auto",
  audioLanguage: null,
  subtitleLanguage: null,
  lowLatency: false,
  pictureFit: "fit",
  resumeMode: "ask",
  watchedPercent: 90,
  liveOnOpen: "last",
  libraryView: "grid",
  librarySort: "newest",
  showContinue: true,
  pauseHistory: false,
  rescanOnStartup: true,
  adminUrl: "",
  defaultSource: null,
  libraryScope: ALL_MEDIA,
  librarySource: "all",
  libraryGenres: [],
  libraryYear: "",
  libraryWatched: "all",
  libraryFilter: "",
};
