import { useRef } from "react";
import { useStreamPlayer } from "@/hooks/useStreamPlayer";
import { PLAYER_LABEL } from "@/lib/live-constants";
import { type PictureFit, objectFitOf } from "@/lib/live-picture";

/** The stage's video element, always rendered and fitted whole by default, with the browser's own controls on the
 *  stage's dark surface in every theme (`--color-stage`, `styles/video.css`). */
export function LivePlayer({ fit }: { readonly fit: PictureFit }) {
  const video = useRef<HTMLVideoElement>(null);
  useStreamPlayer(video);
  return (
    <video
      ref={video}
      aria-label={PLAYER_LABEL}
      controls
      playsInline
      preload="auto"
      className="size-full bg-stage"
      style={{ objectFit: objectFitOf(fit) }}
    />
  );
}
