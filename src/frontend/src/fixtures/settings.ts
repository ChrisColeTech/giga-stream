import type { Settings } from "@/types/settings";

/** PHASE 1 FIXTURE: the settings the Settings window draws, with the defaults of `03` section 3.2. The admin backend
 *  address is left empty: the interface shows the field and never sends a request to it. */
export const SETTINGS_VALUES: Settings = {
  theme: "dark",
  themeAccent: "amber",
  reducedMotion: "system",
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
};
