import { Button } from "@giga/ui/controls/Button";
import { Toolbar } from "@giga/ui/layout/Toolbar";
import { changeReason, type ToolbarAction } from "@/lib/workspace-verbs";
import { ForwardButton } from "./ForwardButton";

export const DISCARD_CHANGES = "Discard changes";
export const DISCARD_TIP = "Put every field back as it was saved";

export interface WorkspaceToolbarProps {
  readonly dirty: boolean;
  readonly onDiscard: () => void;
  /** A reason of the page's own that outranks `Nothing has changed.` (`Loading.` while a title's detail is read). */
  readonly blocked?: string;
  /** The page's forward verb (`Titles →`); absent on a page that has none (Accounts). */
  readonly forward?: ToolbarAction;
}

/** A workspace's page toolbar (LoRA Trainer `pages/datasets/DatasetWorkspace.tsx` 61-72): its verbs on the left, the
 *  ghost `Discard changes` (disabled with `Nothing has changed.` while the draft equals its baseline), and the forward
 *  verb rightmost. `Save details` ends the form's body, never here. */
export function WorkspaceToolbar({ dirty, onDiscard, blocked, forward }: WorkspaceToolbarProps) {
  return (
    <Toolbar
      left={
        <Button size="sm" variant="ghost" title={DISCARD_TIP} reason={blocked ?? changeReason(dirty)} onClick={onDiscard}>
          {DISCARD_CHANGES}
        </Button>
      }
      right={forward === undefined ? undefined : <ForwardButton verb={forward} />}
    />
  );
}
