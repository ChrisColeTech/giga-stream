import { ToolbarStrip } from "@giga/ui/shell/ToolbarStrip";
import { workspaceVerbs, type WorkspaceVerbs } from "@/lib/workspace-verbs";

export interface WorkspaceToolbarProps extends WorkspaceVerbs {
  /** The strip's accessible name, `Channel toolbar`. */
  readonly label: string;
}

/** A workspace's toolbar strip: `Discard changes`, `Save`, and the page's forward verb. ONE Save per page (`28` section
 *  9, item 1). The verbs and their reasons are `workspaceVerbs`; the strip is the library's. */
export function WorkspaceToolbar({ label, ...verbs }: WorkspaceToolbarProps) {
  return <ToolbarStrip label={label} verbs={workspaceVerbs(verbs)} />;
}
