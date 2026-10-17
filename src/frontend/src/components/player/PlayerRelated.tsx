import { RelatedCard } from "@/components/player/RelatedCard";
import { RelatedSkeleton } from "@/components/player/RelatedSkeleton";
import { Disclosure } from "@/components/ui/Disclosure";
import { FoldBody } from "@/components/ui/FoldBody";
import { IconButton } from "@/components/ui/IconButton";
import { RELATED_BASIS_LABEL, RELATED_LOCAL_REASON } from "@/lib/player-copy";
import type { PlayerCommands } from "@/lib/player-commands";
import { sameRef } from "@/lib/player-session";
import type { PlayerView } from "@/lib/player-view";

export interface PlayerRelatedProps {
  readonly view: PlayerView;
  readonly folded: boolean;
  readonly onToggle: () => void;
  readonly commands: PlayerCommands;
}

/** The related band across the bottom (`06` section 5.5), drawn as Giga LoRA Studio's bottom rail (`PastRuns`): a
 *  header of the lowercase mono word and the count, the basis after it, and a collapse toggle; beneath it the
 *  thumbnail row. Loading and empty are eight thumbnail skeletons; a local file's band is folded and its toggle is
 *  off with the reason. */
export function PlayerRelated({ view, folded, onToggle, commands }: PlayerRelatedProps) {
  const local = view.tab?.kind === "local";
  const isFolded = local || folded;
  const hasCards = view.related.length > 0;
  const current = view.tab?.ref;
  const label = isFolded ? "Expand related titles" : "Collapse related titles";

  const toggle = (
    <IconButton
      aria-label={label}
      title={local ? RELATED_LOCAL_REASON : label}
      disabled={local}
      onClick={onToggle}
    >
      <Disclosure open={!isFolded} />
    </IconButton>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-7 flex-none items-center gap-2 px-2">
        {local ? <span className="inline-flex" title={RELATED_LOCAL_REASON}>{toggle}</span> : toggle}
        <span className="font-mono text-[11px] text-muted">
          {hasCards ? `related — ${view.related.length}` : "related"}
        </span>
        {hasCards && <span className="font-mono text-[11px] text-muted">{RELATED_BASIS_LABEL}</span>}
      </div>
      <FoldBody open={!isFolded} className="min-h-0 flex-1">
        <div className="h-full">
          {hasCards ? (
            <div
              role="listbox"
              aria-label="Related titles"
              className="flex h-full items-stretch gap-1.5 overflow-x-auto bg-panel px-2.5 py-1.5"
            >
              {view.related.map((item) => (
                <RelatedCard
                  key={`${item.ref.kind}-${item.ref.id}`}
                  item={item}
                  selected={current !== undefined && sameRef(item.ref, current)}
                  onOpen={() => commands.openRelated(item)}
                />
              ))}
            </div>
          ) : (
            <RelatedSkeleton />
          )}
        </div>
      </FoldBody>
    </div>
  );
}
