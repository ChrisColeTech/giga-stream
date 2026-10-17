import { useState, type CSSProperties } from "react";
import { useReduceMotion } from "@giga/ui/hooks/useReduceMotion";
import { DUR_FAST_MS, EASE_OUT } from "@giga/ui/lib/motion-timing";
import { posterTone } from "@/lib/poster-tone";

/** A 2:3 poster. With an image, it is the image. With none, or one that cannot be shown, the poster is drawn in its
 *  place: a tinted tile in the title's own colour family, with the title set large at its foot, the way a poster is
 *  laid out. The title is the content itself, never placeholder copy. A `compact` poster (a list thumbnail) is too small
 *  to set the title in, so its drawn poster is the tint alone; the row beside it names the title. */
export function PosterImage({
  src,
  alt,
  className,
  compact = false,
}: {
  src?: string;
  alt: string;
  className?: string;
  compact?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [loadedSrc, setLoadedSrc] = useState<string | undefined>(undefined);
  const reduceMotion = useReduceMotion();
  const showImage = src !== undefined && src !== "" && !failed;
  const frame = `relative aspect-[2/3] w-full overflow-hidden rounded-card ${className ?? ""}`;

  const tone = `var(${posterTone(alt)})`;
  const background: CSSProperties = {
    background: `linear-gradient(170deg, color-mix(in srgb, ${tone} 46%, var(--color-surface)) 0%, var(--color-surface) 78%)`,
  };

  /* The tile stays until the picture has arrived, then the picture fades in over it. A picture already decoded when it
     mounts (cached) is marked loaded in the ref callback, before the first paint, so it never flashes the tile. */
  if (showImage) {
    const shown = loadedSrc === src;
    const fade: CSSProperties = {
      opacity: shown ? 1 : 0,
      transition: reduceMotion ? "none" : `opacity ${DUR_FAST_MS}ms cubic-bezier(${EASE_OUT.join(",")})`,
    };
    return (
      <div className={frame} style={background}>
        <img
          ref={(img) => { if (img?.complete && img.naturalWidth > 0) setLoadedSrc(src); }}
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoadedSrc(src)}
          onError={() => setFailed(true)}
          style={fade}
          className="size-full object-cover"
        />
      </div>
    );
  }

  return (
    <div className={frame} style={background} role="img" aria-label={alt}>
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: `color-mix(in srgb, ${tone} 70%, transparent)` }}
      />
      {!compact && (
        <span className="absolute inset-x-2.5 bottom-3 line-clamp-4 text-left font-sans text-[15px] leading-[1.15] font-semibold tracking-tight text-text">
          {alt}
        </span>
      )}
    </div>
  );
}
