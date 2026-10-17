import { DEFAULT_SETTINGS } from "@/constants/settings-defaults";
import type { TitleSource } from "@/services/schemas/source-schema";
import type { PlaybackPrefs } from "@/types/settings";
import type { PlayerTab, StageState } from "@/types/player";

export interface PlaybackTabState extends PlayerTab {
  readonly sources: readonly TitleSource[];
  readonly activeSourceId: number | null;
  readonly stage: StageState;
}

export interface PlaybackSlice {
  playback: PlaybackPrefs;
  playerTabs: readonly PlaybackTabState[];
  activePlayerTabId: string | null;
  setPlayback: (change: Partial<PlaybackPrefs>) => void;
  setPlayerTabs: (tabs: readonly PlaybackTabState[]) => void;
  setActivePlayerTab: (id: string | null) => void;
}

interface Host extends PlaybackSlice {
  settingsRevision: number;
}

type Set = (partial: Partial<Host>) => void;
type Get = () => Host;

export function playbackSlice(set: Set, get: Get): PlaybackSlice {
  return {
    playback: {
      autoplay: DEFAULT_SETTINGS.autoplay,
      videoQuality: DEFAULT_SETTINGS.videoQuality,
      audioLanguage: DEFAULT_SETTINGS.audioLanguage,
      subtitleLanguage: DEFAULT_SETTINGS.subtitleLanguage,
      lowLatency: DEFAULT_SETTINGS.lowLatency,
      pictureFit: DEFAULT_SETTINGS.pictureFit,
      resumeMode: DEFAULT_SETTINGS.resumeMode,
      watchedPercent: DEFAULT_SETTINGS.watchedPercent,
      liveOnOpen: DEFAULT_SETTINGS.liveOnOpen,
    },
    playerTabs: [],
    activePlayerTabId: null,
    setPlayback: (change) =>
      set({ playback: { ...get().playback, ...change }, settingsRevision: get().settingsRevision + 1 }),
    setPlayerTabs: (playerTabs) => set({ playerTabs }),
    setActivePlayerTab: (activePlayerTabId) => set({ activePlayerTabId }),
  };
}
