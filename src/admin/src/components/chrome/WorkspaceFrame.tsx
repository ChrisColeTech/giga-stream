import type { ReactNode } from "react";
import { WorkspaceSplit } from "@giga/ui/panes/WorkspaceSplit";
import { PANE_ENGINE } from "@/store/pane-host";
import type { Tab } from "@/types/shell";

export interface WorkspaceFrameProps {
  readonly tab: Tab;
  /** Whether the tab is the one shown; an inactive tab stays mounted, hidden, so its scroll and forms survive. */
  readonly active: boolean;
  /** The rail (`RecordRail`), the engine's left pane: resizable by its sash, collapsed by the titlebar's toggle. */
  readonly rail: ReactNode;
  /** The page toolbar (`WorkspaceToolbar`): the centre pane's first child, above the scrolling page. */
  readonly toolbar: ReactNode;
  /** The scrolling page of groups. */
  readonly children: ReactNode;
}

/** A workspace: the library pane engine bound to the admin's store, the rail as its left pane (`<tab>.left`, limits from
 *  `constants/tabs.ts`) and, as its centre, the page toolbar over the scrolling page (LoRA Trainer
 *  `pages/datasets/DatasetWorkspace.tsx` 60-73): the toolbar never scrolls away. The geometry is the engine's alone; this
 *  file only places the parts. */
export function WorkspaceFrame({ tab, active, rail, toolbar, children }: WorkspaceFrameProps) {
  return (
    <WorkspaceSplit
      engine={PANE_ENGINE}
      surface={tab}
      active={active}
      left={rail}
      center={
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {toolbar}
          {children}
        </div>
      }
    />
  );
}
