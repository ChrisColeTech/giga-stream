import { DEFAULT_SETTINGS } from "@/constants/settings-defaults";
import type { PlaybackPrefs } from "@/types/settings";
import type { PlayerMediaState, PlayerTab, StageState } from "@/types/player";

export interface PlaybackSlice {
  playback: PlaybackPrefs;
  playerItem: PlayerTab | null;
  playerMedia: PlayerMediaState;
  setPlayback: (change: Partial<PlaybackPrefs>) => void;
  setPlayerItem: (item: PlayerTab | null) => void;
  setPlayerSources: (sources: PlayerMediaState["sources"], activeSourceId: string | null) => void;
  setPlayerSource: (id: string) => void;
  setPlayerStage: (stage: StageState) => void;
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
    playerItem: null,
    playerMedia: { sources: [], activeSourceId: null, stage: { kind: "idle" } },
    setPlayback: (change) =>
      set({ playback: { ...get().playback, ...change }, settingsRevision: get().settingsRevision + 1 }),
    setPlayerItem: (playerItem) => set({ playerItem }),
    setPlayerSources: (sources, activeSourceId) =>
      set({ playerMedia: { sources, activeSourceId, stage: sources.length > 0 ? { kind: "loading" } : { kind: "idle" } } }),
    setPlayerSource: (activeSourceId) => set({ playerMedia: { ...get().playerMedia, activeSourceId, stage: { kind: "loading" } } }),
    setPlayerStage: (stage) => set({ playerMedia: { ...get().playerMedia, stage } }),
  };
}
