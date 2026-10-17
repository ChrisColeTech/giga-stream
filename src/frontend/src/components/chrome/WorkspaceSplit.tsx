import type { ReactNode } from "react";
import { WorkspaceSplit as PaneWorkspace } from "@giga/ui/panes/WorkspaceSplit";
import type { PaneEngine } from "@giga/ui/panes/pane-types";
import { STAGE_MIN_HEIGHT, SURFACES } from "@/constants/surfaces";
import { useVideoRepaint } from "@/hooks/useVideoRepaint";
import { useAppStore } from "@/store/app-store";
import type { Surface } from "@/types/shell";

export interface WorkspaceSplitProps {
  surface: Surface;
  active: boolean;
  left?: ReactNode;
  center: ReactNode;
  right?: ReactNode;
  bottom?: ReactNode;
}

/** What the interface gives the family pane engine: its store, its three surfaces' limits, the bottom row's floor, and
 *  the video repaint hook. WHY the repaint is injected: every surface stays mounted and the inactive ones are hidden,
 *  and a surface's panes can change while it is hidden (Theatre, a restored layout, a narrow window), which leaves its
 *  video painted at the old width. The hook runs right after the splitter's, as it always did. */
const ENGINE: PaneEngine = {
  host: useAppStore,
  table: SURFACES,
  stageMin: STAGE_MIN_HEIGHT,
  useRepaint: useVideoRepaint,
};

/** THE WORKSPACE of a surface: the family pane engine (`@giga/ui/panes/WorkspaceSplit`) bound to the interface's store,
 *  limits and video repaint. The pages place their panes; the geometry is the engine's alone. */
export function WorkspaceSplit(props: WorkspaceSplitProps) {
  return <PaneWorkspace engine={ENGINE} {...props} />;
}
