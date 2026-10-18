import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { PLAYER_IDLE, type PlayerStatus } from "@/lib/preview-state";
import { createPreviewPlayer, HLS_ENGINES, type PreviewPlayer } from "@/services/preview-player";

export interface PreviewPlayerView {
  readonly videoRef: RefObject<HTMLVideoElement | null>;
  readonly status: PlayerStatus;
  /** Stops every request at once; the window calls it before it closes. */
  readonly detach: () => void;
}

/** The Preview's player instance (`36` section 8): made for the window's `<video>` when it mounts and destroyed when it
 *  unmounts. A new address, or a new attempt (`Retry`), plays again; no address detaches. */
export function usePreviewPlayer(address: string | null, attempt: number): PreviewPlayerView {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const player = useRef<PreviewPlayer | null>(null);
  const [status, setStatus] = useState<PlayerStatus>(PLAYER_IDLE);

  useEffect(() => {
    const video = videoRef.current;
    if (video === null) return;
    const made = createPreviewPlayer(video, HLS_ENGINES, setStatus);
    player.current = made;
    return () => {
      made.dispose();
      player.current = null;
    };
  }, []);

  useEffect(() => {
    const current = player.current;
    if (current === null) return;
    if (address === null) {
      current.detach();
      setStatus(PLAYER_IDLE);
    } else current.play(address);
  }, [address, attempt]);

  const detach = useCallback(() => player.current?.detach(), []);
  return { videoRef, status, detach };
}
