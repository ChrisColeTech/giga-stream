import { useState } from "react";
import { posterTone } from "@/lib/poster-tone";

export interface RelatedPictureProps {
  readonly src: string | undefined;
  /** The title. It is the picture's text alternative only; a thumbnail with no picture carries no words. */
  readonly alt: string;
}

/** The picture inside a related thumbnail (`PastRuns`): the image fills the frame. With no image, or one that cannot be
 *  shown, the frame is tinted in the title's colour family and carries no words. */
export function RelatedPicture({ src, alt }: RelatedPictureProps) {
  const [failed, setFailed] = useState(false);
  if (src !== undefined && src !== "" && !failed) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="block size-full object-cover"
      />
    );
  }
  const tone = `var(${posterTone(alt)})`;
  return (
    <span
      aria-hidden
      className="block size-full"
      style={{ background: `color-mix(in srgb, ${tone} 46%, var(--color-surface))` }}
    />
  );
}
