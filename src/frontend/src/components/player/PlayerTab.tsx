import { FileVideo, Film, Tv, X, type LucideIcon } from "lucide-react";
import type { MouseEvent } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { cn } from "@/lib/cn";
import type { PlayerTab as TabItem } from "@/types/player";

const GLYPH: Record<TabItem["kind"], LucideIcon> = { movie: Film, tv: Tv, local: FileVideo };

export interface PlayerTabProps {
  readonly tab: TabItem;
  readonly active: boolean;
  readonly onActivate: () => void;
  readonly onClose: () => void;
  readonly onContextMenu: (event: MouseEvent<HTMLDivElement>) => void;
}

/** One tab of the strip: a glyph, the title, the exact episode beneath it as a subtitle, and a close icon. Activation and
 *  close are separate controls, so the close icon is never nested inside the tab's button. */
export function PlayerTab({ tab, active, onActivate, onClose, onContextMenu }: PlayerTabProps) {
  const Glyph = GLYPH[tab.kind];
  return (
    <div
      data-on={active ? "" : undefined}
      onContextMenu={onContextMenu}
      className={cn(
        "group flex h-full min-w-[120px] max-w-[200px] flex-none items-center gap-1 border-r border-hair pr-1 pl-2.5",
        "data-on:bg-panel data-on:shadow-[inset_0_-2px_0_var(--color-accent)]",
        "bg-surface text-muted hover:bg-hov hover:text-text",
      )}
    >
      <button
        type="button"
        onClick={onActivate}
        aria-current={active ? "true" : undefined}
        title={tab.subtitle === undefined ? tab.title : `${tab.title} ${tab.subtitle}`}
        className="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-left font-sans text-xs"
      >
        <Glyph className="size-3.5 flex-none" aria-hidden />
        <span className="min-w-0 truncate">{tab.title}</span>
        {tab.subtitle !== undefined && (
          <span className="flex-none font-mono text-[10px] text-dim tabular-nums">{tab.subtitle}</span>
        )}
      </button>
      <IconButton aria-label={`Close ${tab.title}`} title={`Close ${tab.title}`} onClick={onClose}>
        <X className="size-3" aria-hidden />
      </IconButton>
    </div>
  );
}
