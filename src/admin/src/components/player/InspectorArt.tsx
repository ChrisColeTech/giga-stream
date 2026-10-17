import { useState } from "react";
import { posterTone } from "@/lib/poster-tone";

export interface InspectorArtProps {
  readonly src: string | undefined;
  /** The title, for the color family of the tint when there is no picture. Never written on the art. */
  readonly title: string;
}

/** The Overview's art: the full width of the pane at 16:9, so it tracks the pane as it resizes and never sits off to one
 *  side. `flex-none`: it sits in the section's flex column, and an aspect-ratio box is the one child that would shrink
 *  there instead of the section scrolling. A poster is cropped from its upper part, where the title art sits. With no picture the frame is tinted in the
 *  title's color family and carries no words; the title is written once, under it. */
export function InspectorArt({ src, title }: InspectorArtProps) {
  const [failed, setFailed] = useState(false);
  const tone = `var(${posterTone(title)})`;
  return (
    <div
      className="relative aspect-video w-full flex-none overflow-hidden rounded-card border border-border bg-surface"
      style={{ background: `linear-gradient(160deg, color-mix(in srgb, ${tone} 46%, var(--color-surface)) 0%, var(--color-surface) 82%)` }}
    >
      {src !== undefined && src !== "" && !failed && (
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="absolute inset-0 block size-full object-cover object-[center_20%]"
        />
      )}
    </div>
  );
}
