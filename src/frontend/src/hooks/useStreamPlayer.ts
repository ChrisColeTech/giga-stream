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

/** Whether the stop acts on THIS controller: the stream it attached must be the live slice's current stream, not
 *  another media (a player-surface movie) that merely rides the hook while a live channel plays elsewhere. The
 *  hook remembers the manifest it attached; the effect compares it with the slice's before `stopLive` and the
 *  detach (`50` section 2.4's instrumented stop). */
export function liveStopApplies(attachedStreamUrl: string | null, playingStreamUrl: string | null): boolean {
  return attachedStreamUrl !== null && attachedStreamUrl === playingStreamUrl;
}

/** Connects the one Live video element to its controller; neither the store nor the component owns media objects. */
export function useStreamPlayer(video: RefObject<HTMLVideoElement | null>): void {
  const controller = useRef<StreamPlayerController | null>(null);
  const attachedStreamUrl = useRef<string | null>(null);
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
      attachedStreamUrl.current = null;
    };
  }, [video]);

  /* The statusbar's bar reads the store (`50` section 2.3): Live is busy while its channel list loads or a stream is
     starting, and the flag clears on rest, failure and unmount alike. */
  useEffect(() => {
    useAppStore.getState().setActivity("live", channelsLoading || streamStarting);
    return () => useAppStore.getState().setActivity("live", false);
  }, [channelsLoading, streamStarting]);

  /* Stop (`50` section 2.4): the serial's change is the stop — but only when THIS controller attached the live
     slice's stream (the manifest it holds must equal the slice's `playingStreamUrl`). A controller holding other
     media — a player-surface movie that rode this hook — never detaches on stop, even while a live channel plays
     elsewhere; that stop is NativePlayer's pause. */
  useEffect(() => {
    if (stopRequest === 0) return;
    const state = useAppStore.getState();
    if (!liveStopApplies(attachedStreamUrl.current, state.playingStreamUrl)) return;
    state.stopLive();
    attachedStreamUrl.current = null;
    detachForStop(controller.current);
  }, [stopRequest]);

  useEffect(() => {
    const state = useAppStore.getState();
    if (serial > 0 && state.playingStreamUrl !== null) {
      attachedStreamUrl.current = state.playingStreamUrl;
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
