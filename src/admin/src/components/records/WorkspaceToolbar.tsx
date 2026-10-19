import { Button } from "@giga/ui/controls/Button";
import { Toolbar } from "@giga/ui/layout/Toolbar";
import { SAVE, SAVE_TIP } from "@/constants/record-copy";
import { changeReason, type SaveVerb, type ToolbarAction, type ToolbarVerb } from "@/lib/workspace-verbs";
import { ForwardButton } from "./ForwardButton";
import { PromoteButton } from "./PromoteButton";

export const DISCARD_CHANGES = "Discard changes";
export const DISCARD_TIP = "Put every field back as it was saved";

export interface WorkspaceToolbarProps {
  readonly dirty: boolean;
  readonly onDiscard: () => void;
  /** A reason of the page's own that outranks `Nothing has changed.` (`Loading.` while a title's detail is read). */
  readonly blocked?: string;
  /** The page's ONE Save (`55` decision 1): the small primary on the right, before the promote. Absent while a
   *  record is still being read (a title's skeleton page draws no commit). */
  readonly save?: SaveVerb;
  /** The page's promote that is not a forward verb (`Run job` on a job's workspace), rightmost. */
  readonly promote?: ToolbarVerb;
  /** The page's forward verb (`Titles →`); absent on a page that has none (Accounts). */
  readonly forward?: ToolbarAction;
}

/** A workspace's page toolbar (`55` decision 1, amending `01` section 9): LEFT, `Discard changes` only (the ghost,
 *  disabled with `Nothing has changed.` while the draft equals its baseline). RIGHT, the ONE `Save` (the small
 *  primary), then the page's promote rightmost - the forward verb, or `Run job` on the Jobs workspace. The form's
 *  trailing save is gone; the save's wiring moved here unchanged. */
export function WorkspaceToolbar({ dirty, onDiscard, blocked, save, promote, forward }: WorkspaceToolbarProps) {
  return (
    <Toolbar
      left={
        <Button size="sm" variant="ghost" title={DISCARD_TIP} reason={blocked ?? changeReason(dirty)} onClick={onDiscard}>
          {DISCARD_CHANGES}
        </Button>
      }
      right={
        <>
          {save !== undefined && (
            <Button size="sm" variant="primary" title={SAVE_TIP} reason={save.reason} onClick={save.onPress}>
              {SAVE}
            </Button>
          )}
          {promote !== undefined && <PromoteButton verb={promote} />}
          {forward !== undefined && <ForwardButton verb={forward} />}
        </>
      }
    />
  );
}
