import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@giga/ui/controls/Button";
import { IconButton } from "@giga/ui/controls/IconButton";
import { Actions } from "@giga/ui/form/Actions";
import { Sep } from "@giga/ui/layout/Sep";
import { RETRY_LABEL } from "@/constants/preview-copy";
import type { PreviewVerbs } from "@/hooks/usePreviewVerbs";
import type { PreviewWalk } from "@/hooks/usePreviewWalk";

export interface PreviewToolbarProps {
  readonly walk: PreviewWalk;
  readonly retry: boolean;
  readonly onRetry: () => void;
  readonly verbs: PreviewVerbs;
}

const FLAT = "flex-none";

/** The Preview's toolbar (`36` sections 8.1 and 8.3), the shared pinned `Actions` strip directly under the header, laid out as
 *  LoRA Trainer's `ViewerToolbar`: tools LEFT, navigation RIGHT. Left, what changes the channel, as ghost verbs (icon first
 *  where the icon vocabulary has one): `Enable` (Check) / `Disable` (X), `Mark live` / `Mark dead` (a stream channel only;
 *  the word alone) and `Retry` when offered. Right, only `Previous` and `Next`. The channel's name is the window's title
 *  (8.2) and its state word and `N / total` are the window's status bar (8.3): the toolbar holds controls only. */
export function PreviewToolbar({ walk, retry, onRetry, verbs }: PreviewToolbarProps) {
  const { plan } = verbs;
  const Icon = plan.enable.label === "Enable" ? Check : X;
  return (
    <Actions
      pinned
      left={
        <>
          <Button className={FLAT} size="sm" variant="ghost" reason={plan.enable.reason} onClick={verbs.toggleEnabled}>
            <Icon className="size-3.5" aria-hidden /> {plan.enable.label}
          </Button>
          {plan.mark !== null && (
            <>
              <Sep />
              <Button className={FLAT} size="sm" variant="ghost" reason={plan.mark.reason} onClick={verbs.mark}>
                {plan.mark.label}
              </Button>
            </>
          )}
          {retry && (
            <Button className={FLAT} size="sm" variant="ghost" title="Play the channel again" onClick={onRetry}>
              {RETRY_LABEL}
            </Button>
          )}
        </>
      }
    >
      <IconButton className={FLAT} aria-label="Previous" title="Previous (←)" reason={walk.reasons.previous}
        onClick={() => walk.step(-1)}>
        <ChevronLeft className="size-4" aria-hidden />
      </IconButton>
      <IconButton className={FLAT} aria-label="Next" title="Next (→)" reason={walk.reasons.next}
        onClick={() => walk.step(1)}>
        <ChevronRight className="size-4" aria-hidden />
      </IconButton>
    </Actions>
  );
}
