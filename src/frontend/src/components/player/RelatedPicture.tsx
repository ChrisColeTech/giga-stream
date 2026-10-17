import { useState } from "react";

export interface RelatedPictureProps {
  readonly src: string | undefined;
  /** The title. The thumbnail's tooltip carries it; the picture itself is decorative. */
  readonly alt: string;
}

/** The picture inside a related thumbnail, as `PastRuns` draws it: the image fills the frame. With no image, or one that
 *  cannot be shown, the frame's own surface shows, with no tint and no words (`06` section 5.5). */
export function RelatedPicture({ src }: RelatedPictureProps) {
  const [failed, setFailed] = useState(false);
  if (src === undefined || src === "" || failed) return null;
  return (
    <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} className="block size-full object-cover" />
  );
}
