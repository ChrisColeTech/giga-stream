import { Film } from "lucide-react";
import { useState } from "react";

/** A 2:3 poster box. With no image, or an image that cannot be shown, the fallback glyph is drawn. */
export function PosterImage({ src, alt, className }: { src?: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const showImage = src !== undefined && src !== "" && !failed;

  return (
    <div className={`relative aspect-[2/3] w-full overflow-hidden rounded-card bg-surface ${className ?? ""}`}>
      {showImage ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      ) : (
        <span className="grid size-full place-items-center text-dim" role="img" aria-label={alt}>
          <Film className="size-6" aria-hidden />
        </span>
      )}
    </div>
  );
}
