import { useEffect, useRef } from "react";
import { objectFitOf } from "@/lib/live-picture";
import { applyOpeningPosition, attemptPlayerPlay } from "@/lib/player-opening";
import { StreamPlayerController } from "@/services/stream-player";
import { useAppStore } from "@/store/app-store";
import type { PictureFit } from "@/types/settings";
import type { StageState } from "@/types/player";

export interface NativePlayerProps {
  readonly url: string;
  readonly label: string;
  readonly positionMs: number;
  readonly autoplay: boolean;
  readonly userInitiated: boolean;
  readonly retry: number;
  readonly pictureFit: PictureFit;
  readonly errorReason: string;
  readonly onState: (state: StageState) => void;
  readonly onProgress: (positionMs: number, durationMs?: number) => void;
  readonly onPlaying: (playing: boolean) => void;
  readonly onSeeked: () => void;
  readonly onEnded: () => void;
}

const isHls = (url: string): boolean => /\.m3u8(?:$|[?#])/i.test(url);
const preferences = () => {
  const playback = useAppStore.getState().playback;
  return {
    videoQuality: playback.videoQuality,
    audioLanguage: playback.audioLanguage,
    subtitleLanguage: playback.subtitleLanguage,
    lowLatency: playback.lowLatency,
  };
};

/** Native media host for local Range addresses and app-player streams. */
export function NativePlayer(props: NativePlayerProps) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const node = video.current;
    if (node === null) return undefined;
    let controller: StreamPlayerController | null = null;
    if (isHls(props.url)) {
      controller = new StreamPlayerController(node, preferences(), {
        onState: (kind, reason) => props.onState(kind === "failed" ? { kind, reason: reason ?? "The stream could not be loaded." } : { kind }),
        onFacts: () => undefined,
        onPlayRefused: (sentence) => useAppStore.getState().say(sentence, "warn"),
      });
      controller.attach({ url: props.url, autoplay: props.autoplay, userInitiated: props.userInitiated });
    } else {
      props.onState({ kind: "loading" });
      node.src = props.url;
      node.load();
      attemptPlayerPlay(node, props.autoplay, props.userInitiated, () => useAppStore.getState().say(
          "Playback stayed paused because the browser refused to start it.", "warn",
      ));
    }
    return () => {
      controller?.destroy();
      node.pause();
      node.removeAttribute("src");
      node.load();
    };
  }, [props.url, props.retry]);

  return (
    <video
      ref={video}
      controls
      playsInline
      preload="metadata"
      aria-label={props.label}
      className="size-full bg-stage"
      style={{ objectFit: objectFitOf(props.pictureFit) }}
      onLoadedMetadata={(event) => applyOpeningPosition(event.currentTarget, props.positionMs)}
      onLoadedData={() => props.onState({ kind: "ready" })}
      onTimeUpdate={(event) => props.onProgress(
        event.currentTarget.currentTime * 1000,
        Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration * 1000 : undefined,
      )}
      onPlay={() => props.onPlaying(true)}
      onPause={() => props.onPlaying(false)}
      onSeeked={props.onSeeked}
      onEnded={props.onEnded}
      onError={() => props.onState({ kind: "failed", reason: props.errorReason })}
    />
  );
}
