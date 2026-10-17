import { useState, type CSSProperties } from "react";
import { posterTone } from "@/lib/poster-tone";

/** A 2:3 poster. With an image, it is the image. With none, or one that cannot be shown, the poster is drawn in its
 *  place: a tinted tile in the title's own colour family, with the title set large at its foot, the way a poster is
 *  laid out. The title is the content itself, never placeholder copy. */
export function PosterImage({ src, alt, className }: { src?: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const showImage = src !== undefined && src !== "" && !failed;
  const frame = `relative aspect-[2/3] w-full overflow-hidden rounded-card ${className ?? ""}`;

  if (showImage) {
    return (
      <div className={frame}>
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      </div>
    );
  }

  const tone = `var(${posterTone(alt)})`;
  const background: CSSProperties = {
    background: `linear-gradient(170deg, color-mix(in srgb, ${tone} 46%, var(--color-surface)) 0%, var(--color-surface) 78%)`,
  };

  return (
    <div className={frame} style={background} role="img" aria-label={alt}>
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: `color-mix(in srgb, ${tone} 70%, transparent)` }}
      />
      <span className="absolute inset-x-2.5 bottom-3 line-clamp-4 text-left font-sans text-[15px] leading-[1.15] font-semibold tracking-tight text-text">
        {alt}
      </span>
    </div>
  );
}
