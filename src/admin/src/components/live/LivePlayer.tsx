import { PLAYER_LABEL } from "@/lib/live-constants";
import { type PictureFit, objectFitOf } from "@/lib/live-picture";

/** The stage's video element, always rendered and fitted whole by default, with the browser's own controls on the
 *  stage's dark surface in every theme (`--color-stage`, `styles/video.css`). Phase 1 sets no source and loads nothing (`02` section 3.1). */
export function LivePlayer({ fit }: { readonly fit: PictureFit }) {
  return (
    <video
      aria-label={PLAYER_LABEL}
      controls
      playsInline
      preload="none"
      className="size-full bg-stage"
      style={{ objectFit: objectFitOf(fit) }}
    />
  );
}
