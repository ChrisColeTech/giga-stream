import { useEffect, useRef, type VideoHTMLAttributes } from "react";
import { applyOpeningPosition, attemptPlayerPlay } from "@/lib/player-opening";
import { isHlsAddress, nativeAttachmentKey, pauseForStop, positionOf } from "@/lib/native-player";
import { StreamPlayerController } from "@/services/stream-player";
import { useAppStore } from "@/store/app-store";
import type { StageState } from "@/types/player";

export interface NativePlayerInput {
  readonly url: string;
  readonly positionMs: number;
  readonly autoplay: boolean;
  readonly userInitiated: boolean;
  readonly retry: number;
  readonly errorReason: string;
  readonly onState: (state: StageState) => void;
  readonly onProgress: (positionMs: number, durationMs?: number) => void;
  readonly onPlaying: (playing: boolean) => void;
  readonly onEnded: () => void;
}

const preferences = () => {
  const playback = useAppStore.getState().playback;
  return {
    videoQuality: playback.videoQuality,
    audioLanguage: playback.audioLanguage,
    subtitleLanguage: playback.subtitleLanguage,
    lowLatency: playback.lowLatency,
  };
};

/** Owns the native element's controller, media lifecycle and stop request. */
export function useNativePlayer(input: NativePlayerInput) {
  const video = useRef<HTMLVideoElement>(null);
  const stopRequest = useAppStore((state) => state.stopRequest);
  const attachmentKey = nativeAttachmentKey(input.url, input.retry);
  useEffect(() => {
    const node = video.current;
    if (node === null) return undefined;
    let controller: StreamPlayerController | null = null;
    if (isHlsAddress(input.url)) {
      controller = new StreamPlayerController(node, preferences(), {
        onState: (kind, reason) => input.onState(
          kind === "failed" ? { kind, reason: reason ?? "The stream could not be loaded." } : { kind },
        ),
        onFacts: () => undefined,
        onPlayRefused: (sentence) => useAppStore.getState().say(sentence, "warn"),
        onEvent: (event) => useAppStore.getState().logEvent(event),
      });
      controller.attach({ url: input.url, autoplay: input.autoplay, userInitiated: input.userInitiated });
    } else {
      input.onState({ kind: "loading" });
      node.src = input.url;
      node.load();
      attemptPlayerPlay(node, input.autoplay, input.userInitiated, () => useAppStore.getState().say(
        "Playback stayed paused because the browser refused to start it.",
        "warn",
      ));
    }
    return () => {
      controller?.destroy();
      node.pause();
      node.removeAttribute("src");
      node.load();
    };
  }, [attachmentKey]);
  useEffect(() => {
    if (stopRequest !== 0) pauseForStop(video.current);
  }, [stopRequest]);

  const events: VideoHTMLAttributes<HTMLVideoElement> = {
    onLoadedMetadata: (event) => {
      applyOpeningPosition(event.currentTarget, input.positionMs);
      input.onProgress(...positionOf(event.currentTarget));
    },
    onLoadedData: () => input.onState({ kind: "ready" }),
    onTimeUpdate: (event) => input.onProgress(...positionOf(event.currentTarget)),
    onSeeked: (event) => input.onProgress(...positionOf(event.currentTarget)),
    onPlay: () => {
      useAppStore.getState().setPlayerPaused(false);
      input.onPlaying(true);
    },
    onPause: () => {
      useAppStore.getState().setPlayerPaused(true);
      input.onPlaying(false);
    },
    onEnded: (event) => {
      const [, duration] = positionOf(event.currentTarget);
      if (duration !== undefined) input.onProgress(duration, duration);
      useAppStore.getState().setPlayerPaused(true);
      input.onEnded();
    },
    onError: () => input.onState({ kind: "failed", reason: input.errorReason }),
  };
  return { video, events };
}
