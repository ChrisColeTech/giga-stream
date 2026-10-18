import type { RefObject } from "react";
import { SHIMMER_TILE } from "@giga/ui/lib/shimmer";
import { PREVIEW_VIDEO_LABEL } from "@/constants/preview-copy";

export interface PreviewStageProps {
  readonly videoRef: RefObject<HTMLVideoElement | null>;
  /** The channel is being read or built: the shimmer covers the picture and nothing is attached. */
  readonly skeleton: boolean;
}

/** The Preview's stage (`28` section 7.4): the `<video>` always mounted, muted with the native controls, fitted whole on
 *  the stage colour (dark in every theme); while the channel is read or built a shimmer the size of the picture lies
 *  over it, never an empty card. */
export function PreviewStage({ videoRef, skeleton }: PreviewStageProps) {
  return (
    <div className="relative min-h-0 w-full flex-1 overflow-hidden rounded-ctl bg-stage">
      <video
        ref={videoRef}
        className="absolute inset-0 size-full object-contain"
        aria-label={PREVIEW_VIDEO_LABEL}
        controls
        muted
        playsInline
      />
      {skeleton && <span className={`${SHIMMER_TILE} absolute inset-0`} aria-hidden />}
    </div>
  );
}
