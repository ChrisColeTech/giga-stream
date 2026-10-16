import type { ReactNode } from "react";
import { Allotment } from "allotment";
import { STAGE_MIN_HEIGHT, SURFACES, limitsOf } from "@/constants/surfaces";
import { useWorkspaceSplit } from "@/hooks/useWorkspaceSplit";
import { cn } from "@/lib/cn";
import { usePaneOpen } from "@/store/selectors";
import type { Surface } from "@/types/shell";

export interface WorkspaceSplitProps {
  surface: Surface;
  active: boolean;
  left?: ReactNode;
  center: ReactNode;
  right?: ReactNode;
  bottom?: ReactNode;
}

/** THE WORKSPACE: the sole owner of pane geometry (ported from Giga Cut). A vertical Allotment [row | bottom] whose
 *  top pane holds the horizontal [left | centre | right]. The bottom pane is a SIBLING of the whole row, which is what
 *  makes ONE row gutter resize all three top panes against it together. Sizes, clamps, collapses and adoption live in
 *  useWorkspaceSplit; this file only composes. Every surface stays mounted so a switch never loses its panes; the
 *  inactive ones are `hidden`. */
export function WorkspaceSplit({ surface, active, left, center, right, bottom }: WorkspaceSplitProps) {
  const split = useWorkspaceSplit(surface);
  const config = SURFACES[surface];
  const leftOpen = usePaneOpen(surface, "left");
  const rightOpen = usePaneOpen(surface, "right");
  const bottomOpen = usePaneOpen(surface, "bottom");
  const hasLeft = limitsOf(surface, "left") !== null;
  const hasRight = limitsOf(surface, "right") !== null;
  const hasBottom = limitsOf(surface, "bottom") !== null;

  const row = (
    <Allotment
      ref={split.rowRef}
      proportionalLayout={false}
      defaultSizes={split.defaultRow}
      onChange={split.onRowChange}
      onDragStart={split.onRowDragStart}
      onDragEnd={split.onRowDragEnd}
    >
      {hasLeft && (
        <Allotment.Pane minSize={split.minFor("left")} maxSize={split.maxFor("left")}>
          <div className="pane pane-left" data-open={leftOpen || undefined} aria-label="Left pane">
            {left}
          </div>
        </Allotment.Pane>
      )}
      <Allotment.Pane minSize={config.centerMin}>
        <div className="pane pane-center" aria-label="Centre">
          {center}
        </div>
      </Allotment.Pane>
      {hasRight && (
        <Allotment.Pane minSize={split.minFor("right")} maxSize={split.maxFor("right")}>
          <div className="pane pane-right" data-open={rightOpen || undefined} aria-label="Right pane">
            {right}
          </div>
        </Allotment.Pane>
      )}
    </Allotment>
  );

  return (
    <div className={cn("workspace", !active && "hidden")} ref={split.boxRef}>
      {hasBottom ? (
        <Allotment
          ref={split.columnRef}
          vertical
          proportionalLayout={false}
          defaultSizes={split.defaultColumn}
          onChange={split.onColumnChange}
          onDragStart={split.onColumnDragStart}
          onDragEnd={split.onColumnDragEnd}
        >
          <Allotment.Pane minSize={STAGE_MIN_HEIGHT}>{row}</Allotment.Pane>
          <Allotment.Pane minSize={split.minFor("bottom")} maxSize={split.maxFor("bottom")}>
            <div className="pane pane-bottom" data-open={bottomOpen || undefined} aria-label="Bottom pane">
              {bottom}
            </div>
          </Allotment.Pane>
        </Allotment>
      ) : (
        row
      )}
    </div>
  );
}
