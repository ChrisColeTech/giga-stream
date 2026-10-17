import { useEffect, useRef, type RefObject } from "react";
import { StreamPlayerController } from "@/services/stream-player";
import { useAppStore } from "@/store/app-store";
import type { StreamPreferences } from "@/types/stream-player";

const preferencesOf = (): StreamPreferences => {
  const playback = useAppStore.getState().playback;
  return {
    videoQuality: playback.videoQuality,
    audioLanguage: playback.audioLanguage,
    subtitleLanguage: playback.subtitleLanguage,
    lowLatency: playback.lowLatency,
  };
};

/** Connects the one Live video element to its controller; neither the store nor the component owns media objects. */
export function useStreamPlayer(video: RefObject<HTMLVideoElement | null>): void {
  const controller = useRef<StreamPlayerController | null>(null);
  const serial = useAppStore((state) => state.livePlaySerial);
  const videoQuality = useAppStore((state) => state.playback.videoQuality);
  const audioLanguage = useAppStore((state) => state.playback.audioLanguage);
  const subtitleLanguage = useAppStore((state) => state.playback.subtitleLanguage);
  const lowLatency = useAppStore((state) => state.playback.lowLatency);

  useEffect(() => {
    if (video.current === null) return;
    controller.current = new StreamPlayerController(video.current, preferencesOf(), {
      onState: (state, reason) => useAppStore.getState().setLiveStage(state, reason),
      onFacts: (facts) => useAppStore.getState().setLiveStreamFacts(facts),
    });
    return () => {
      controller.current?.destroy();
      controller.current = null;
    };
  }, [video]);

  useEffect(() => {
    const state = useAppStore.getState();
    if (serial > 0 && state.playingStreamUrl !== null) {
      controller.current?.attach({
        url: state.playingStreamUrl,
        autoplay: state.playback.autoplay,
        userInitiated: state.livePlayUserInitiated,
      });
    }
  }, [serial]);

  useEffect(() => {
    controller.current?.updatePreferences({ videoQuality, audioLanguage, subtitleLanguage, lowLatency });
  }, [audioLanguage, lowLatency, subtitleLanguage, videoQuality]);
}
