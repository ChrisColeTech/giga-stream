import { RelatedCard } from "@/components/player/RelatedCard";
import { Disclosure } from "@/components/ui/Disclosure";
import { FoldBody } from "@/components/ui/FoldBody";
import { IconButton } from "@/components/ui/IconButton";
import { SkeletonCards } from "@/components/ui/SkeletonCards";
import { RELATED_BASIS_LABEL, RELATED_LOCAL_REASON, RELATED_SKELETON_COUNT } from "@/lib/player-copy";
import type { PlayerCommands } from "@/lib/player-commands";
import type { PlayerView } from "@/lib/player-view";

export interface PlayerRelatedProps {
  readonly view: PlayerView;
  readonly folded: boolean;
  readonly onToggle: () => void;
  readonly commands: PlayerCommands;
}

/** The related band across the bottom (`06` section 5.5): the word Related, the basis it was found by, and a collapse
 *  toggle. Cards are 2:3 posters, at most twenty. Loading and empty are eight card skeletons; a local file's band is
 *  folded and its toggle is off with the reason. */
export function PlayerRelated({ view, folded, onToggle, commands }: PlayerRelatedProps) {
  const local = view.tab?.kind === "local";
  const isFolded = local || folded;
  const hasCards = view.related.length > 0;
  const label = isFolded ? "Expand related titles" : "Collapse related titles";

  const toggle = (
    <IconButton aria-label={label} title={local ? RELATED_LOCAL_REASON : label} disabled={local} on={!isFolded} onClick={onToggle}>
      <Disclosure open={!isFolded} />
    </IconButton>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-7 flex-none items-center gap-2 px-2">
        {local ? <span className="inline-flex" title={RELATED_LOCAL_REASON}>{toggle}</span> : toggle}
        <span className="font-mono text-[11px] font-semibold text-muted">Related</span>
        {hasCards && <span className="font-mono text-[10px] text-dim">{RELATED_BASIS_LABEL}</span>}
      </div>
      <FoldBody open={!isFolded} className="min-h-0 flex-1">
        <div className="h-full overflow-hidden">
          {hasCards ? (
            <div className="flex h-full items-start gap-2 overflow-x-auto px-2 pb-2">
              {view.related.map((item) => (
                <RelatedCard key={`${item.ref.kind}-${item.ref.id}`} item={item} onOpen={() => commands.openRelated(item)} />
              ))}
            </div>
          ) : (
            /* The shared grid is auto-fill at 144 px and would wrap; these !important overrides pin it to one row of eight
             * 48 px columns, the width of a 2:3 card at the band's 140 px height, and keep it from wrapping. */
            <div className="h-full overflow-hidden [&>div]:!grid-flow-col [&>div]:!grid-cols-[repeat(8,48px)] [&>div]:!gap-2 [&>div]:!p-1 [&>div]:w-max">
              <SkeletonCards count={RELATED_SKELETON_COUNT} />
            </div>
          )}
        </div>
      </FoldBody>
    </div>
  );
}
