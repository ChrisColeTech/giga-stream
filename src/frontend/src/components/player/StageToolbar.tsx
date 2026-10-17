import { FileVideo, Film, FolderOpen, Maximize, Minimize, RotateCcw, Tv, type LucideIcon } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { EXIT_FULLSCREEN_LABEL, FULLSCREEN_LABEL } from "@/lib/player-copy";
import type { PlayerTab } from "@/types/player";

const KIND_ICON: Record<PlayerTab["kind"], LucideIcon> = { movie: Film, tv: Tv, local: FileVideo };

export interface StageToolbarProps {
  readonly kind: PlayerTab["kind"];
  readonly title: string;
  /** The episode or file name, beneath the title. */
  readonly subtitle: string | undefined;
  readonly fullscreen: boolean;
  readonly onFullscreen: () => void;
  readonly onRetry: () => void;
  readonly onReveal: () => void;
}

/** The stage's toolbar (`06` section 5.3): the media kind at the left, the title at the centre, and icon actions at the
 *  right: Retry, Reveal in Library and Fullscreen. */
export function StageToolbar({ kind, title, subtitle, fullscreen, onFullscreen, onRetry, onReveal }: StageToolbarProps) {
  const Kind = KIND_ICON[kind];
  const fullscreenLabel = fullscreen ? EXIT_FULLSCREEN_LABEL : FULLSCREEN_LABEL;
  return (
    <div className="flex h-9 flex-none items-center gap-2 border-b border-hair bg-panel px-2.5">
      <Kind className="size-4 flex-none text-muted" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col items-center leading-tight">
        <span className="max-w-full truncate text-[13px] font-semibold text-text">{title}</span>
        {subtitle !== undefined && <span className="max-w-full truncate font-mono text-[11px] text-dim">{subtitle}</span>}
      </div>
      <div className="flex flex-none items-center gap-0.5">
        <IconButton aria-label="Retry" title="Retry" onClick={onRetry}>
          <RotateCcw className="size-3.5" aria-hidden />
        </IconButton>
        <IconButton aria-label="Reveal in Library" title="Reveal in Library" onClick={onReveal}>
          <FolderOpen className="size-3.5" aria-hidden />
        </IconButton>
        <IconButton aria-label={fullscreenLabel} title={`${fullscreenLabel} (F)`} on={fullscreen} onClick={onFullscreen}>
          {fullscreen ? <Minimize className="size-3.5" aria-hidden /> : <Maximize className="size-3.5" aria-hidden />}
        </IconButton>
      </div>
    </div>
  );
}
