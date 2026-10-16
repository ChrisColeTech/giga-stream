import { Tv } from "lucide-react";
import { useState } from "react";

/** A 4:3 channel logo box. With no logo, or one that cannot be shown, the fallback glyph is drawn. */
export function LogoImage({ src, alt }: { src?: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  const showImage = src !== undefined && src !== "" && !failed;

  return (
    <div className="relative aspect-[4/3] w-14 flex-none overflow-hidden rounded-ctl border border-hair bg-surface">
      {showImage ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="size-full object-contain"
        />
      ) : (
        <span className="grid size-full place-items-center text-dim" role="img" aria-label={alt}>
          <Tv className="size-3.5" aria-hidden />
        </span>
      )}
    </div>
  );
}
