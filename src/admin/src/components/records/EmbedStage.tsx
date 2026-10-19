import { useCallback, type RefObject } from "react";
import { SHIMMER_TILE } from "@giga/ui/lib/shimmer";
import { EMBED_ALLOW, EMBED_REFERRER, type EmbedTarget } from "@/lib/embed-frame";
import { clearPlayerPolicy, hostAvailable, setPlayerPolicy } from "@/services/admin-host";

export interface EmbedStageProps {
  /** The frame the window blanks on close, so picture and sound stop before the exit fade. */
  readonly frameRef: RefObject<HTMLIFrameElement | null>;
  /** What the frame plays; null rests at `about:blank`. */
  readonly target: EmbedTarget | null;
  /** The stage wears the shimmer (the read the choice waits on is running). */
  readonly skeleton: boolean;
  /** The player's name, for the frame's `title`. */
  readonly label: string;
}

/** A preview window's stage (`55` decisions 7 and 8): the interface's embed host's iframe, not a video - `allow` list,
 *  `allowFullScreen`, `referrerPolicy="origin"`, NO `sandbox` (owner, 2026-10-17), `src="about:blank"` at rest and to
 *  stop, `bg-stage` (dark in every theme). The chosen address loads imperatively from the mount callback, exactly as the
 *  interface's `EmbedHost` does, so the window's player policy is set BEFORE the navigation the frame guard judges; the
 *  policy is cleared when the frame goes (the returned cleanup runs on unmount and before a remount). A shimmer lies over
 *  the picture while the read runs, never a sentence. */
export function EmbedStage({ frameRef, target, skeleton, label }: EmbedStageProps) {
  const mount = useCallback(
    (frame: HTMLIFrameElement | null): (() => void) | undefined => {
      frameRef.current = frame;
      if (frame === null) return undefined;
      const clear = (): void => clearPlayerPolicy();
      if (target === null) return clear;
      if (hostAvailable() && !setPlayerPolicy({ origin: target.origin, frameOrigins: [...target.frameOrigins] })) {
        return clear;
      }
      frame.src = target.address;
      return clear;
    },
    [frameRef, target],
  );

  return (
    <div className="relative min-h-0 w-full flex-1 overflow-hidden rounded-ctl bg-stage">
      <iframe
        key={target?.address ?? "none"}
        ref={mount}
        src="about:blank"
        title={label}
        allow={EMBED_ALLOW}
        allowFullScreen
        referrerPolicy={EMBED_REFERRER}
        className="absolute inset-0 size-full border-0"
      />
      {skeleton && <span className={`${SHIMMER_TILE} absolute inset-0`} aria-hidden />}
    </div>
  );
}