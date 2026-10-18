import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@giga/ui/controls/Button";
import { IconButton } from "@giga/ui/controls/IconButton";
import { Actions } from "@giga/ui/form/Actions";
import { SHIMMER_TILE } from "@giga/ui/lib/shimmer";
import { RETRY_LABEL } from "@/constants/preview-copy";
import type { PreviewVerbs } from "@/hooks/usePreviewVerbs";
import type { PreviewWalk } from "@/hooks/usePreviewWalk";

export interface PreviewToolbarProps {
  readonly name: string | undefined;
  /** The window is reading the channels: the name and the place wear a shimmer. */
  readonly reading: boolean;
  readonly walk: PreviewWalk;
  /** The state word (`live`, `loading`, `failed`, `missing`). */
  readonly line: string;
  readonly retry: boolean;
  readonly onRetry: () => void;
  readonly verbs: PreviewVerbs;
}

const FLAT = "flex-none";

/** The Preview's toolbar (`36` section 8.1), the shared pinned `Actions` strip directly under the header, as LoRA Studio's
 *  viewer and Title information draw theirs: `Previous` and `Next`, the place `N / total`, the channel's name and its state
 *  word on the left; `Enable` / `Disable`, `Mark live` / `Mark dead` (a stream channel only) and `Retry` (when offered)
 *  on the right. Nothing sits under the stage. */
export function PreviewToolbar({ name, reading, walk, line, retry, onRetry, verbs }: PreviewToolbarProps) {
  const { plan } = verbs;
  const place = reading && walk.position === null ? null : `${walk.position ?? "–"} / ${walk.total}`;
  return (
    <Actions
      pinned
      left={
        <>
          <IconButton className={FLAT} aria-label="Previous" title="Previous (←)" reason={walk.reasons.previous}
            onClick={() => walk.step(-1)}>
            <ChevronLeft className="size-4" aria-hidden />
          </IconButton>
          <IconButton className={FLAT} aria-label="Next" title="Next (→)" reason={walk.reasons.next}
            onClick={() => walk.step(1)}>
            <ChevronRight className="size-4" aria-hidden />
          </IconButton>
          {place === null ? (
            <span className={`${SHIMMER_TILE} h-3 w-10 flex-none`} aria-hidden />
          ) : (
            <span className="flex-none font-mono text-xs tabular-nums text-faint">{place}</span>
          )}
          {name === undefined ? (
            reading && <span className={`${SHIMMER_TILE} h-3 w-24`} aria-hidden />
          ) : (
            <span className="min-w-0 truncate font-mono text-xs text-muted" title={name}>{name}</span>
          )}
          <span role="status" className="flex-none font-mono text-xs text-muted">{line}</span>
        </>
      }
    >
      <Button className={FLAT} size="sm" reason={plan.enable.reason} onClick={verbs.toggleEnabled}>
        {plan.enable.label}
      </Button>
      {plan.mark !== null && (
        <Button className={FLAT} size="sm" reason={plan.mark.reason} onClick={verbs.mark}>
          {plan.mark.label}
        </Button>
      )}
      {retry && (
        <Button className={FLAT} variant="ghost" size="sm" title="Play the channel again" onClick={onRetry}>
          {RETRY_LABEL}
        </Button>
      )}
    </Actions>
  );
}
