import { objectFitOf } from "@/lib/live-picture";
import { useNativePlayer } from "@/hooks/useNativePlayer";
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

/** Native media host for local Range addresses and app-player streams. */
export function NativePlayer(props: NativePlayerProps) {
  const player = useNativePlayer(props);

  return (
    <video
      ref={player.video}
      controls
      playsInline
      preload="metadata"
      aria-label={props.label}
      className="size-full bg-stage"
      style={{ objectFit: objectFitOf(props.pictureFit) }}
      {...player.events}
    />
  );
}
