import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@giga/ui/controls/Button";
import { IconButton } from "@giga/ui/controls/IconButton";
import { Toggle } from "@giga/ui/controls/Toggle";
import { Actions } from "@giga/ui/form/Actions";
import { Tooltip } from "@giga/ui/form/Tooltip";
import { Sep } from "@giga/ui/layout/Sep";
import { RETRY_LABEL } from "@/constants/preview-copy";
import type { PreviewVerbs } from "@/hooks/usePreviewVerbs";
import type { PreviewWalk } from "@/hooks/usePreviewWalk";
import type { ToggleVerb } from "@/lib/preview-verbs";

export interface PreviewToolbarProps {
  readonly walk: PreviewWalk;
  readonly retry: boolean;
  readonly onRetry: () => void;
  readonly verbs: PreviewVerbs;
}

const FLAT = "flex-none";
const LABEL = "text-xs text-muted";

/** The family Toggle with its plain label beside it, the label part of the control's hit target (`51` section 2.6): a
 *  press on the words flips the switch too. A switch that cannot be flipped now is natively disabled, and its reason
 *  rides the wrapper tooltip — the browser drops a disabled control's own `title`, so the wrapper span carries it (the
 *  `IconButton` pattern); a working switch keeps its own title (an unchecked stream's note). Not exported. */
function labelled(verb: ToggleVerb, name: string, flip: (on: boolean) => void): ReactNode {
  const control = (
    <label className={`flex flex-none items-center gap-1.5 ${verb.reason === undefined ? "cursor-pointer" : ""}`}>
      <Toggle
        checked={verb.checked}
        aria-label={name}
        title={verb.reason === undefined ? verb.title : undefined}
        disabled={verb.reason !== undefined}
        onChange={flip}
      />
      <span className={LABEL}>{name}</span>
    </label>
  );
  return verb.reason === undefined ? (
    control
  ) : (
    <Tooltip text={verb.reason} focusable label={`${name}. ${verb.reason}`} className={FLAT}>
      {control}
    </Tooltip>
  );
}

/** The Preview's toolbar (`36` sections 8.1 and 8.3, `51` section 2.6), the shared pinned `Actions` strip directly under
 *  the header: controls LEFT, navigation RIGHT. Left, the two toggles — `Enabled` (the channel's boolean, the existing
 *  `PATCH { enabled }` verb) and `Online` (the stream verdict, absent for a live-kind channel exactly as `Mark` was) —
 *  then `Retry` when offered. Right, only `Previous` and `Next`. The channel's name is the window's title (8.2) and its
 *  state word, health word and `N / total` are the window's status bar (8.3, `51` section 2.5). */
export function PreviewToolbar({ walk, retry, onRetry, verbs }: PreviewToolbarProps) {
  const { plan } = verbs;
  return (
    <Actions
      pinned
      left={
        <>
          {labelled(plan.enabled, "Enabled", () => verbs.toggleEnabled())}
          {plan.online !== null && (
            <>
              <Sep />
              {labelled(plan.online, "Online", (on) => verbs.mark(on ? "online" : "offline"))}
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
