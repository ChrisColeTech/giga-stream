import { Button } from "@giga/ui/controls/Button";
import { Toolbar } from "@giga/ui/layout/Toolbar";
import { changeReason, type ToolbarAction, type ToolbarVerb } from "@/lib/workspace-verbs";
import { ForwardButton } from "./ForwardButton";

export const DISCARD_CHANGES = "Discard changes";
export const DISCARD_TIP = "Put every field back as it was saved";

export interface WorkspaceToolbarProps {
  readonly dirty: boolean;
  readonly onDiscard: () => void;
  /** A reason of the page's own that outranks `Nothing has changed.` (`Loading.` while a title's detail is read). */
  readonly blocked?: string;
  /** The page's own verbs (`Run job`, `Stop`), drawn leftmost, before `Discard changes` (`53` section 2.3). */
  readonly verbs?: readonly ToolbarVerb[];
  /** The page's forward verb (`Titles →`); absent on a page that has none (Accounts). */
  readonly forward?: ToolbarAction;
}

/** A workspace's page toolbar (LoRA Trainer `pages/datasets/DatasetWorkspace.tsx` 61-72): its verbs on the left, the
 *  ghost `Discard changes` (disabled with `Nothing has changed.` while the draft equals its baseline), and the forward
 *  verb rightmost. `Save details` ends the form's body, never here. */
export function WorkspaceToolbar({ dirty, onDiscard, blocked, verbs, forward }: WorkspaceToolbarProps) {
  return (
    <Toolbar
      left={
        <>
          {(verbs ?? []).map((verb) => (
            <Button
              key={verb.label}
              size="sm"
              variant={verb.variant ?? "ghost"}
              title={verb.tip}
              reason={verb.reason}
              onClick={verb.onPress}
            >
              {verb.icon === undefined ? null : <verb.icon className="size-3.5" aria-hidden />}
              {verb.label}
            </Button>
          ))}
          <Button size="sm" variant="ghost" title={DISCARD_TIP} reason={blocked ?? changeReason(dirty)} onClick={onDiscard}>
            {DISCARD_CHANGES}
          </Button>
        </>
      }
      right={forward === undefined ? undefined : <ForwardButton verb={forward} />}
    />
  );
}
