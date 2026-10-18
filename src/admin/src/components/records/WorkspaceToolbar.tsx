import { ToolbarStrip } from "@giga/ui/shell/ToolbarStrip";
import { forwardVerbs, type ToolbarAction } from "@/lib/workspace-verbs";

export interface WorkspaceToolbarProps {
  /** The strip's accessible name, `Channel toolbar`. */
  readonly label: string;
  /** The page's forward verb (`Titles`), an arrow icon; absent on a page that has none (Accounts). */
  readonly forward?: ToolbarAction;
}

/** A workspace's toolbar strip: the forward arrow and nothing else. Save ends the form's body (`SaveDetails`) and
 *  Discard is the form's pinned ghost verb (`DiscardBar`), as in the Collections window (`01` section 9). */
export function WorkspaceToolbar({ label, forward }: WorkspaceToolbarProps) {
  return <ToolbarStrip label={label} verbs={forwardVerbs(forward)} />;
}
