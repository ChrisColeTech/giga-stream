import { useEffect, useRef, type RefObject } from "react";
import { registerLiveStreamTarget, syncLiveStream } from "@/services/live-stream-session";
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

/** Stop's live action (`50` section 2.4): the controller's detach primitive sends the engine back to the idle stage. */
export function detachForStop(player: { readonly detach: () => void } | null | undefined): void {
  player?.detach();
}

/** Whether the stream this hook holds is one the LIVE slice owns: the slice's playing channel is set. The stop
 *  effect answers this before it acts — the instrumented re-drive caught the detach destroying an engine behind a
 *  player-surface stream (`50` section 2.4), whose own stop is NativePlayer's pause. Read before `stopLive` clears
 *  the fact. */
export function liveOwnsStream(playingStreamUrl: string | null): boolean {
  return playingStreamUrl !== null;
}

/** Connects the one Live video element to its controller; neither the store nor the component owns media objects. */
export function useStreamPlayer(video: RefObject<HTMLVideoElement | null>): void {
  const controller = useRef<StreamPlayerController | null>(null);
  const serial = useAppStore((state) => state.livePlaySerial);
  const stopRequest = useAppStore((state) => state.stopRequest);
  const videoQuality = useAppStore((state) => state.playback.videoQuality);
  const audioLanguage = useAppStore((state) => state.playback.audioLanguage);
  const subtitleLanguage = useAppStore((state) => state.playback.subtitleLanguage);
  const lowLatency = useAppStore((state) => state.playback.lowLatency);
  const channelsLoading = useAppStore((state) => state.channelsLoading);
  const streamStarting = useAppStore((state) => state.liveStage === "loading");

  useEffect(() => {
    if (video.current === null) return;
    const player = new StreamPlayerController(video.current, preferencesOf(), {
      onState: (state, reason) => useAppStore.getState().setLiveStage(state, reason),
      onFacts: (facts) => useAppStore.getState().setLiveStreamFacts(facts),
      onPlayRefused: (sentence) => useAppStore.getState().say(sentence, "warn"),
      onEvent: (input) => useAppStore.getState().logEvent(input),
    });
    controller.current = player;
    const unregister = registerLiveStreamTarget(player, useAppStore.getState().livePlaySerial);
    return () => {
      unregister();
      controller.current?.destroy();
      controller.current = null;
    };
  }, [video]);

  /* The statusbar's bar reads the store (`50` section 2.3): Live is busy while its channel list loads or a stream is
     starting, and the flag clears on rest, failure and unmount alike. */
  useEffect(() => {
    useAppStore.getState().setActivity("live", channelsLoading || streamStarting);
    return () => useAppStore.getState().setActivity("live", false);
  }, [channelsLoading, streamStarting]);

  /* Stop (`50` section 2.4): the serial's change is the stop — but only for a stream the LIVE slice owns (the
     playing channel is set; read before `stopLive` clears it). The store's live state returns to rest and the
     engine detaches back to the idle stage. A stream that is not the slice's (a player-surface stream this hook
     does not own) gets no detach: that stop is NativePlayer's pause. */
  useEffect(() => {
    if (stopRequest === 0) return;
    const state = useAppStore.getState();
    if (!liveOwnsStream(state.playingStreamUrl)) return;
    state.stopLive();
    detachForStop(controller.current);
  }, [stopRequest]);

  useEffect(() => {
    const state = useAppStore.getState();
    if (serial > 0 && state.playingStreamUrl !== null) {
      syncLiveStream({
        url: state.playingStreamUrl,
        autoplay: state.playback.autoplay,
        userInitiated: state.livePlayUserInitiated,
      }, serial);
    }
  }, [serial]);

  useEffect(() => {
    controller.current?.updatePreferences({ videoQuality, audioLanguage, subtitleLanguage, lowLatency });
  }, [audioLanguage, lowLatency, subtitleLanguage, videoQuality]);
}
