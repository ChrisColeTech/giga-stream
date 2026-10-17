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
  readonly onEnded: () => void;
}

/** The element's real position and length; a live or unknown length (`Infinity`, `NaN`) reports none. */
const positionOf = (media: HTMLVideoElement): [number, number | undefined] => [
  Math.round(media.currentTime * 1000),
  Number.isFinite(media.duration) && media.duration > 0 ? Math.round(media.duration * 1000) : undefined,
];

const isHls = (url: string): boolean => /\.m3u8(?:$|[?#])/i.test(url);
export const nativeAttachmentKey = (url: string, retry: number): string => `${url}\u0000${retry}`;
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
  const attachmentKey = nativeAttachmentKey(props.url, props.retry);
  useEffect(() => {
    const node = video.current;
    if (node === null) return undefined;
    let controller: StreamPlayerController | null = null;
    if (isHls(props.url)) {
      controller = new StreamPlayerController(node, preferences(), {
        onState: (kind, reason) => props.onState(kind === "failed" ? { kind, reason: reason ?? "The stream could not be loaded." } : { kind }),
        onFacts: () => undefined,
        onPlayRefused: (sentence) => useAppStore.getState().say(sentence, "warn"),
        onEvent: (input) => useAppStore.getState().logEvent(input),
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
  }, [attachmentKey]);

  return (
    <video
      ref={video}
      controls
      playsInline
      preload="metadata"
      aria-label={props.label}
      className="size-full bg-stage"
      style={{ objectFit: objectFitOf(props.pictureFit) }}
      onLoadedMetadata={(event) => {
        // Seek first, then report: the report carries the position playback will start from and the real length.
        applyOpeningPosition(event.currentTarget, props.positionMs);
        props.onProgress(...positionOf(event.currentTarget));
      }}
      onLoadedData={() => props.onState({ kind: "ready" })}
      onTimeUpdate={(event) => props.onProgress(...positionOf(event.currentTarget))}
      onSeeked={(event) => props.onProgress(...positionOf(event.currentTarget))}
      onPlay={() => props.onPlaying(true)}
      onPause={() => props.onPlaying(false)}
      onEnded={(event) => {
        // The end is the media's own length, not the last tick before it.
        const [, duration] = positionOf(event.currentTarget);
        if (duration !== undefined) props.onProgress(duration, duration);
        props.onEnded();
      }}
      onError={() => props.onState({ kind: "failed", reason: props.errorReason })}
    />
  );
}
