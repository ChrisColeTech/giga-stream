import { Button } from "@giga/ui/controls/Button";
import { Actions } from "@giga/ui/form/Actions";
import { changeReason } from "@/lib/workspace-verbs";

export const DISCARD_CHANGES = "Discard changes";

export interface DiscardBarProps {
  readonly dirty: boolean;
  readonly onDiscard: () => void;
  /** A reason of the page's own that outranks `Nothing has changed.` (`Loading.` while a title's detail is read). */
  readonly blocked?: string;
}

/** The form's pinned Actions strip (`Actions pinned`, as Title information's): a ghost `Discard changes` above the
 *  scrolling page, disabled with `Nothing has changed.` while the draft equals its baseline. */
export function DiscardBar({ dirty, onDiscard, blocked }: DiscardBarProps) {
  return (
    <Actions
      pinned
      left={
        <Button variant="ghost" reason={blocked ?? changeReason(dirty)} onClick={onDiscard}>
          {DISCARD_CHANGES}
        </Button>
      }
    >
      {null}
    </Actions>
  );
}
